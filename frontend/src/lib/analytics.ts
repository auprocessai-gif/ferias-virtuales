import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/supabaseAuth";

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

function getAnalyticsEndpoint() {
  const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "");

  return apiBaseUrl.endsWith("/api")
    ? `${apiBaseUrl}/analytics/track`
    : `${apiBaseUrl}/api/analytics/track`;
}

async function getCurrentSessionForAnalytics() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch (error) {
    console.warn("[analytics] session unavailable", error);
    return null;
  }
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
    const session = await getCurrentSessionForAnalytics();
    if (!session?.user || !session.access_token) return;

    try {
      const apiResponse = await withTimeout(
        fetch(getAnalyticsEndpoint(), {
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

      const errorBody = await apiResponse.text().catch(() => "");
      console.warn("[analytics] backend event not recorded", apiResponse.status, errorBody);
    } catch (backendError) {
      console.warn("[analytics] backend request failed, trying Supabase fallback", backendError);
    }

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
