export type PointInput = {
  lat: string;
  lng: string;
};

export type PointValidationResult =
  | { ok: true; point: { coordinates: [number, number]; type: "Point" } }
  | { ok: false; error: string };

export type ScheduleValidationResult =
  | { ok: true; isoDateTime: string }
  | { ok: false; error: string };

function parseCoordinate(value: string): number | null {
  const numeric = Number(value.trim());
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

export function validatePointInput(input: PointInput, label: string): PointValidationResult {
  const latitude = parseCoordinate(input.lat);
  const longitude = parseCoordinate(input.lng);

  if (latitude === null || longitude === null) {
    return { ok: false, error: `${label} coordinates must be valid numbers.` };
  }

  if (latitude < -90 || latitude > 90) {
    return { ok: false, error: `${label} latitude must be between -90 and 90.` };
  }

  if (longitude < -180 || longitude > 180) {
    return { ok: false, error: `${label} longitude must be between -180 and 180.` };
  }

  return {
    ok: true,
    point: {
      coordinates: [longitude, latitude],
      type: "Point",
    },
  };
}

export function validateScheduleInput(value: string): ScheduleValidationResult {
  const candidate = value.trim();
  if (!candidate) {
    return { ok: false, error: "Scheduled time is required." };
  }

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Scheduled time must be a valid date and time." };
  }

  if (date.getTime() <= Date.now()) {
    return { ok: false, error: "Scheduled time must be in the future." };
  }

  return { ok: true, isoDateTime: date.toISOString() };
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;

  if (typeof root.error === "string" && root.error.trim()) {
    return root.error;
  }

  if (root.error && typeof root.error === "object") {
    const errorRecord = root.error as Record<string, unknown>;
    if (typeof errorRecord.message === "string" && errorRecord.message.trim()) {
      return errorRecord.message;
    }
  }

  if (typeof root.message === "string" && root.message.trim()) {
    return root.message;
  }

  return null;
}

export function mapApiError(payload: unknown, fallback: string): string {
  return extractErrorMessage(payload) ?? fallback;
}

export function shouldDisableSubmit(pending: boolean, requiredFields: string[]): boolean {
  if (pending) {
    return true;
  }

  return requiredFields.some((field) => !field.trim());
}
