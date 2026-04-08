export type RecordLike = Record<string, unknown>;

export function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

export function unwrapData<T>(payload: unknown): T {
  if (isRecordLike(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export function getErrorMessage(payload: unknown): string | null {
  if (!isRecordLike(payload)) {
    return null;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (isRecordLike(payload.error) && typeof payload.error.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return null;
}

export async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("json") || contentType.includes("+json");

  if (isJson) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

