export function toActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function normalizePageNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  return Math.max(0, Math.trunc(fallback));
}

export function normalizeTotalPages(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }
  return 1;
}

type MutationFallbackInput = {
  requestedPage: number;
  returnedPage: number;
  totalPages: number;
  itemCount: number;
};

export function pageFallbackAfterMutation({
  requestedPage,
  returnedPage,
  totalPages,
  itemCount,
}: MutationFallbackInput): number | null {
  const safeRequestedPage = normalizePageNumber(requestedPage);
  const safeReturnedPage = normalizePageNumber(returnedPage, safeRequestedPage);
  const safeTotalPages = normalizeTotalPages(totalPages);

  if (safeRequestedPage === 0 || itemCount > 0) {
    return null;
  }

  const lastPage = Math.max(0, safeTotalPages - 1);
  if (safeRequestedPage > lastPage || safeReturnedPage > lastPage) {
    return lastPage;
  }

  return null;
}
