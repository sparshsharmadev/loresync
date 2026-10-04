import { apiErrorResponse, ApiError, databaseSetupError, getAuthenticatedContext, readJsonBody } from "@/lib/api-server";
import { updateProfileSchema } from "@/lib/api-schemas";

const fields = ["username", "display_name", "pronouns", "about", "photo", "avatar_style", "avatar_tone", "accent", "density", "type_scale", "reduced_motion", "default_storage", "theme"] as const;
export async function GET(request: Request) {
  try {
    const { client, user } = await getAuthenticatedContext(request);
    const { data, error } = await client.from("profiles").select(fields.join(",")).eq("user_id", user.id).maybeSingle();
    if (error) throw databaseSetupError(error, "Could not load your cloud profile.");
    return Response.json({ profile: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const { client, user } = await getAuthenticatedContext(request);
    const parsed = updateProfileSchema.safeParse(await readJsonBody<unknown>(request, 700_000));
    if (!parsed.success) throw new ApiError(400, "One or more profile fields are invalid or exceed their limits.");
    const row: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString(), ...parsed.data };
    const { data, error } = await client.from("profiles").upsert(row, { onConflict: "user_id" }).select(fields.join(",")).single();
    if (error?.code === "23505") throw new ApiError(409, "That username is already taken. Try another one.");
    if (error) throw databaseSetupError(error, "Could not save your cloud profile.");
    return Response.json({ profile: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { client, user } = await getAuthenticatedContext(request);
    const { error } = await client.from("profiles").delete().eq("user_id", user.id);
    if (error) throw databaseSetupError(error, "Could not remove your cloud profile.");
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
