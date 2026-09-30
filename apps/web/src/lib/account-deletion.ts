export function readAccountDeletionPassword(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (record.confirmation !== "DELETE") return null;
  if (typeof record.password !== "string" || record.password.length < 1 || record.password.length > 1_024) return null;
  return record.password;
}
