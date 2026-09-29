import type { ChatMessage, ChatSummary } from "@loresync/core";
import { getSupabase } from "./supabase";

export async function saveCloudAnalysis(
  title: string,
  platform: "whatsapp" | "discord",
  messages: ChatMessage[],
  summary: ChatSummary,
) {
  const supabase = getSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in to save an analysis to your cloud workspace.");

  const { data: analysis, error } = await supabase
    .from("analyses")
    .insert({
      owner_id: user.id,
      title,
      platform,
      message_count: summary.messageCount,
      participant_count: summary.participantCount,
      first_message_at: summary.firstMessageAt,
      last_message_at: summary.lastMessageAt,
      summary,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  try {
    for (let start = 0; start < messages.length; start += 500) {
      const chunk = messages.slice(start, start + 500).map((message) => ({
        owner_id: user.id,
        analysis_id: analysis.id,
        sent_at: message.timestamp,
        sender: message.sender,
        content: message.content,
        platform,
        has_attachment: message.hasAttachment,
        source_id: message.rawId ?? null,
      }));
      const { error: messageError } = await supabase.from("messages").insert(chunk);
      if (messageError) throw new Error(messageError.message);
    }
  } catch (saveError) {
    await supabase.from("analyses").delete().eq("id", analysis.id);
    throw saveError;
  }
  return analysis.id as string;
}

export async function deleteCloudAnalysis(id: string) {
  const { error } = await getSupabase().from("analyses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
