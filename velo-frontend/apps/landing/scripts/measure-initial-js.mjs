import console from "node:console";
import { Buffer } from "node:buffer";
import { readFile, stat } from "node:fs/promises";
import process from "node:process";
import { resolve, sep } from "node:path";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

const outputDirectory = resolve(import.meta.dirname, "../out");
const buildDirectory = resolve(outputDirectory, "../.next");
const document = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const sourcePaths = new Set(
  [...document.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((source) => source.startsWith("/_next/") && source.endsWith(".js"))
    .map((source) => decodeURIComponent(source.split("?")[0].replace(/^\//, ""))),
);

if (!sourcePaths.size) {
  throw new Error("No initial JavaScript chunks were found in the exported landing route.");
}

const chunks = await Promise.all([...sourcePaths].map(async (source) => {
  const path = resolve(outputDirectory, source);
  if (!path.startsWith(`${outputDirectory}${sep}`)) {
    throw new Error(`JavaScript chunk resolved outside the static output: ${source}`);
  }
  const bytes = await readFile(path);
  return {
    source: `/${source}`,
    raw: bytes.byteLength,
    gzip: gzipSync(bytes, { level: 9 }).byteLength,
    brotli: brotliCompressSync(bytes, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    }).byteLength,
  };
}));

const total = chunks.reduce((size, chunk) => ({
  raw: size.raw + chunk.raw,
  gzip: size.gzip + chunk.gzip,
  brotli: size.brotli + chunk.brotli,
}), { raw: 0, gzip: 0, brotli: 0 });

console.log("Initial JavaScript loaded by apps/landing/out/index.html");
for (const chunk of chunks) {
  const fileSize = await stat(resolve(outputDirectory, chunk.source.slice(1)));
  console.log(`${chunk.source}: ${fileSize.size} B raw, ${chunk.gzip} B gzip, ${chunk.brotli} B Brotli`);
}
console.log(`Total: ${total.raw} B raw, ${total.gzip} B gzip, ${total.brotli} B Brotli`);

const baselineGzip = Number(process.env.LANDING_INITIAL_JS_BASELINE_GZIP);
if (Number.isFinite(baselineGzip) && baselineGzip >= 0) {
  const addedGzip = Math.max(0, total.gzip - baselineGzip);
  console.log(`Added initial JavaScript vs baseline: ${addedGzip} B gzip (budget 8192 B)`);
  if (addedGzip > 8192) throw new Error("Added initial JavaScript exceeds the 8 kB gzip budget.");
} else {
  console.log("Added initial JavaScript: set LANDING_INITIAL_JS_BASELINE_GZIP to compare against a baseline build.");
}

const loadableManifest = JSON.parse(await readFile(resolve(buildDirectory, "react-loadable-manifest.json"), "utf8"));
const dispatchCanvasEntry = Object.entries(loadableManifest).find(([key]) => key.includes("DispatchCanvas"))?.[1];
if (!dispatchCanvasEntry) throw new Error("The deferred DispatchCanvas bundle was not found in the loadable manifest.");
const deferredFiles = [...new Set(dispatchCanvasEntry.files.filter((file) => file.endsWith(".js")))];
const deferredChunks = await Promise.all(deferredFiles.map(async (file) => {
  const path = resolve(buildDirectory, file);
  if (!path.startsWith(`${buildDirectory}${sep}`)) {
    throw new Error(`Deferred scene chunk resolved outside the build: ${file}`);
  }
  const bytes = await readFile(path);
  return { file, raw: bytes.byteLength, gzip: gzipSync(bytes, { level: 9 }).byteLength };
}));
const deferredGzip = deferredChunks.reduce((totalBytes, chunk) => totalBytes + chunk.gzip, 0);
console.log("Deferred three + scene JavaScript");
for (const chunk of deferredChunks) console.log(`${chunk.file}: ${chunk.raw} B raw, ${chunk.gzip} B gzip`);
console.log(`Total: ${deferredGzip} B gzip (budget 204800 B)`);
if (deferredGzip > 204800) throw new Error("The deferred three + scene bundle exceeds the 200 kB gzip budget.");

const inlineSvg = document.match(/<svg\b[^>]*data-dispatch-fallback="true"[^>]*>[\s\S]*?<\/svg>/)?.[0];
if (!inlineSvg) throw new Error("The inline dispatch SVG fallback was not found in index.html.");
const inlineSvgRaw = Buffer.byteLength(inlineSvg);
const inlineSvgGzip = gzipSync(inlineSvg, { level: 9 }).byteLength;
console.log(`Inline SVG fallback: ${inlineSvgRaw} B raw, ${inlineSvgGzip} B gzip (budget 8192 B)`);
if (inlineSvgGzip > 8192) throw new Error("The inline SVG fallback exceeds the 8 kB gzip budget.");
