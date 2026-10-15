import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Poi } from "../types.ts";
import { handleSse } from "./event-hub.ts";
import type { EventHub } from "./event-hub.ts";
import { ControlRequestError } from "./errors.ts";
import type { PatchResult, SimConfig } from "./runtime-config.ts";
import type { ActionAccepted } from "./action-executor.ts";

export interface ControlActions {
  status(): unknown;
  pois(): Poi[];
  getConfig(): SimConfig;
  patchConfig(patch: unknown): PatchResult;
  applyPreset(body: unknown): PatchResult;
  executeAction(name: string, body: unknown): Promise<ActionAccepted>;
  events: EventHub;
}

const panelHtml = readFile(new URL("./panel.html", import.meta.url), "utf8");

export async function dispatchControlRequest(
  request: IncomingMessage,
  response: ServerResponse,
  actions: ControlActions,
): Promise<void> {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  try {
    if (request.method === "GET" && path === "/") {
      sendHtml(response, await panelHtml);
      return;
    }
    if (request.method === "GET" && path === "/status") {
      sendJson(response, 200, actions.status());
      return;
    }
    if (request.method === "GET" && path === "/pois") {
      sendJson(response, 200, actions.pois().map(({ id, name, kind, lat, lng }) => ({ id, name, kind, lat, lng })));
      return;
    }
    if (request.method === "GET" && path === "/config") {
      sendJson(response, 200, { config: actions.getConfig() });
      return;
    }
    if (request.method === "GET" && path === "/events") {
      handleSse(request, response, actions.events);
      return;
    }
    if (request.method === "PATCH" && path === "/config") {
      const result = actions.patchConfig(await readJson(request));
      sendPatchResult(response, result);
      return;
    }
    if (request.method === "POST" && path === "/preset") {
      const result = actions.applyPreset(await readJson(request));
      sendPatchResult(response, result);
      return;
    }
    const actionMatch = path.match(/^\/actions\/([^/]+)$/);
    if (request.method === "POST" && actionMatch) {
      const name = decodeActionName(actionMatch[1]!);
      const result = await actions.executeAction(name, await readJson(request));
      sendJson(response, 202, { accepted: true, summary: result.summary, ...(result.refs ? { refs: result.refs } : {}) });
      return;
    }
    sendJson(response, path === "/" || path === "/status" || path === "/pois" || path === "/config"
      || path === "/preset" || path === "/events" || path.startsWith("/actions/") ? 405 : 404,
    { error: path.startsWith("/actions/") ? "Unknown action route" : "Not found or method not allowed" });
  } catch (error) {
    const status = error instanceof ControlRequestError ? error.status : readStatus(error) ?? 500;
    const message = error instanceof Error ? error.message : "Control request failed";
    sendJson(response, status, { error: message });
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576) throw new ControlRequestError(413, "Request body is too large.");
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ControlRequestError(400, "Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ControlRequestError(400, "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function decodeActionName(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new ControlRequestError(400, "Action name is not valid URL encoding.");
  }
}

function sendPatchResult(response: ServerResponse, result: PatchResult): void {
  if (!result.ok) {
    sendJson(response, 400, { error: result.error });
    return;
  }
  sendJson(response, 200, { config: result.config, changed: result.changed });
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = error.status;
  return typeof status === "number" && status >= 400 && status <= 599 ? status : undefined;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
  });
  response.end(html);
}
