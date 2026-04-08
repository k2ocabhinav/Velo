export type ActionPendingMap = Record<string, boolean>;

export function isActionPending(pendingMap: ActionPendingMap, actionKey: string): boolean {
  return pendingMap[actionKey] === true;
}

export function setActionPending(
  pendingMap: ActionPendingMap,
  actionKey: string,
  pending: boolean,
): ActionPendingMap {
  if (pending) {
    return {
      ...pendingMap,
      [actionKey]: true,
    };
  }

  if (!(actionKey in pendingMap)) {
    return pendingMap;
  }

  const next = { ...pendingMap };
  delete next[actionKey];
  return next;
}

export function toAsyncErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
