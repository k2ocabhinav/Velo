export type DispatchOperationResult = { ok: true } | { ok: false; error: unknown };

export async function executeDispatchOperation(
  operation: () => Promise<void>,
): Promise<DispatchOperationResult> {
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
