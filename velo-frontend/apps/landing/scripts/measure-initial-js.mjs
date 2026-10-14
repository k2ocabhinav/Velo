import console from "node:console";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

const outputDirectory = resolve(import.meta.dirname, "../out");
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
