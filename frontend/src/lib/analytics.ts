import { supabase } from "@/lib/supabase";
import { getSessionWithTimeout, withTimeout } from "@/lib/supabaseAuth";

export type AnalyticsAction =
  | "fair_entered"
  | "pavilion_entered"
  | "stand_viewed"
  | "auditorium_entered"
  | "stand_cta_clicked"
  | "document_opened"
  | "video_played"
  | "chat_message_sent";

interface TrackAnalyticsInput {
  eventId?: string | null;
  pavilionId?: string | null;
  standId?: string | null;
  action: AnalyticsAction;
  metadata?: Record<string, unknown>;
}

export async function trackAnalyticsEvent({
  eventId,
  pavilionId,
  standId,
  action,
  metadata = {},
}: TrackAnalyticsInput) {
  if (!eventId) return;

  try {
    const { data: { session } } = await getSessionWithTimeout("Analytics session check");
    if (!session?.user || !session.access_token) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const apiResponse = await withTimeout(
      fetch(`${apiBaseUrl}/analytics/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId,
          pavilionId: pavilionId ?? null,
          standId: standId ?? null,
          action,
          metadata,
        }),
      }),
      "Analytics API insert timed out",
      5000
    );

    if (apiResponse.ok) return;

    console.warn("[analytics] backend event not recorded", apiResponse.status);

    const { error } = await withTimeout(
      supabase.from("analytics_events").insert({
        event_id: eventId,
        pavilion_id: pavilionId ?? null,
        stand_id: standId ?? null,
        user_id: session.user.id,
        event_type: action,
        action,
        metadata,
      }),
      "Analytics insert timed out",
      5000
    );

    if (error) {
      console.warn("[analytics] event not recorded", error.message);
    }
  } catch (error) {
    console.warn("[analytics] skipped", error);
  }
}
