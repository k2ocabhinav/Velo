import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const fixtureUrl = new URL("../../tests/e2e/tenant-branding.json", import.meta.url);
const branding = JSON.parse(await readFile(fixtureUrl, "utf8"));
const port = Number.parseInt(process.env.PLAYWRIGHT_MOCK_API_PORT ?? "7104", 10);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200).end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/public/tenant/branding") {
    response.writeHead(200, { "Cache-Control": "public, max-age=60" })
      .end(JSON.stringify({ data: branding }));
    return;
  }

  response.writeHead(404).end(JSON.stringify({ error: "No e2e API fixture for this route." }));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`E2E mock API listening on 127.0.0.1:${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
