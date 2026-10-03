import { deleteAccountSchema } from "./api-schemas";

export function readAccountDeletionPassword(body: unknown): string | null {
  const parsed = deleteAccountSchema.safeParse(body);
  return parsed.success ? parsed.data.password : null;
}
