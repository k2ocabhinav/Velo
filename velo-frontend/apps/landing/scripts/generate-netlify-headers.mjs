import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { createSecurityHeaders } from "@velo/config/security-headers";

const outputDirectory = resolve(import.meta.dirname, "../out");
const headers = createSecurityHeaders({ environment: "production" });
const contents = [
  "/*",
  ...headers.map(({ key, value }) => `  ${key}: ${value}`),
  "",
].join("\n");

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "_headers"), contents, "utf8");

const contactAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION?.trim();
const redirectsPath = resolve(outputDirectory, "_redirects");
if (contactAction) {
  const target = new URL(contactAction);
  if (target.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_CONTACT_FORM_ACTION must use HTTPS.");
  }
  await writeFile(redirectsPath, `/_velo/contact ${target.toString()} 200!\n`, "utf8");
} else {
  await rm(redirectsPath, { force: true });
}
