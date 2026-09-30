import "server-only";

import { createClient } from "@supabase/supabase-js";
import { apiErrorResponse, ApiError, getAuthenticatedContext, readJsonBody } from "@/lib/api-server";
import { readAccountDeletionPassword } from "@/lib/account-deletion";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export async function DELETE(request: Request) {
  try {
    const { user } = await getAuthenticatedContext(request);
    const body = await readJsonBody<unknown>(request, 4_096);
    const password = readAccountDeletionPassword(body);
    if (password === null) throw new ApiError(400, 'Enter your password and type "DELETE" to confirm account deletion.');
    if (!user.email) throw new ApiError(400, "This account cannot be deleted with password confirmation. Contact support.");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publishableKey || !serviceRoleKey) throw new ApiError(503, "Account deletion is not configured on this deployment.");

    const verifier = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout(10_000) },
    });
    const { error: passwordError } = await verifier.auth.signInWithPassword({ email: user.email, password });
    if (passwordError) throw new ApiError(401, "We could not confirm your password. Your account was not deleted.");

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout(10_000) },
    });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new ApiError(500, "Could not delete your account. Please try again later.");

    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
