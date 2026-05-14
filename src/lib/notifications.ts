import { supabase } from "@/integrations/supabase/client";

type NotifType = "new_application" | "ai_score_complete" | "candidate_offer" | "candidate_hired";

export async function createNotificationForAll(
  type: NotifType,
  title: string,
  message: string,
  link?: string,
) {
  try {
    const { data: profiles } = await supabase.from("profiles").select("id");
    if (!profiles || profiles.length === 0) return;
    const rows = profiles.map((p) => ({
      user_id: p.id,
      type,
      title,
      message,
      link: link ?? null,
    }));
    await supabase.from("notifications").insert(rows);
  } catch (e) {
    // notifications are best-effort
    console.error("notification fan-out failed", e);
  }
}
