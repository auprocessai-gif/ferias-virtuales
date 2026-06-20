"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Pavilion from "@/components/fair/Pavilion";
import StandDetail from "@/components/fair/StandDetail";
import Auditorium from "@/components/fair/Auditorium";
import FairAssistant, { type FairAssistantRecommendation } from "@/components/fair/FairAssistant";
import { useFairStore } from "@/store/useFairStore";
import { Stand } from "@/../../shared";
import { Map as MapIcon } from "lucide-react";
import { trackAnalyticsEvent } from "@/lib/analytics";

type AccessStatus = "checking" | "granted" | "pending" | "denied";
interface PavilionNavItem {
  id: string;
  name: string;
}

interface StoredSession {
  access_token?: string;
  expires_at?: number;
  user?: {
    id?: string;
    email?: string;
  };
}

const withTimeout = async <T,>(promise: PromiseLike<T>, message: string, timeoutMs = 30000): Promise<T> => {
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;

  const authKeys = Object.keys(window.localStorage)
    .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
    .sort((key) => key.includes("auprocessia-supabase") ? -1 : 1);

  for (const key of authKeys) {
    try {
      const value = window.localStorage.getItem(key);
      if (!value) continue;

      const parsed = JSON.parse(value);
      const session = (parsed?.currentSession || parsed) as StoredSession;
      if (session?.access_token && session?.user?.id) return session;
    } catch (error) {
      console.warn("[expo] invalid stored auth session", error);
    }
  }

  return null;
}

const getSessionResultWithRetry = async () => {
  const storedSession = readStoredSession();
  if (storedSession?.user?.id) {
    return { data: { session: storedSession } };
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await withTimeout(
        supabase.auth.getSession(),
        "No se pudo comprobar la sesion.",
        5000
      );

      if (result.data.session?.user) return result;
    } catch (err) {
      lastError = err;
      console.warn(`[expo] session check attempt ${attempt + 1} failed`, err);
    }

    await wait(700);
  }

  if (lastError) throw lastError;
  return { data: { session: null } };
};

export default function FairExpoPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { view, selectedStand, setSelectedStand, setView, setCurrentEvent } = useFairStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadExpired, setLoadExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("checking");

  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [pavilions, setPavilions] = useState<PavilionNavItem[]>([]);
  const [activePavilionId, setActivePavilionId] = useState<string | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [standsLoading, setStandsLoading] = useState(false);
  const standsRequestId = useRef(0);
  const standsCache = useRef<Map<string, Stand[]>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !loading) {
      setLoadExpired(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoadExpired(true);
    }, 32000);

    return () => window.clearTimeout(timeoutId);
  }, [mounted, loading]);

  useEffect(() => {
    async function fetchFairData() {
      if (!slug || !mounted) return;

      try {
        setLoading(true);
        setError(null);
        setAccessStatus("checking");

        const { data: { session } } = await getSessionResultWithRetry();
        if (!session?.user) {
          const search = typeof window !== "undefined" ? window.location.search : "";
          router.replace(`/login?redirect=${encodeURIComponent(`/expo/${slug}${search}`)}`);
          return;
        }

        const { data: event, error: eventErr } = await withTimeout(
          supabase
            .from("events")
            .select("*")
            .eq("slug", slug)
            .single(),
          "La feria está tardando demasiado en cargar."
        );

        if (eventErr || !event) {
          throw new Error("Feria no encontrada o no disponible.");
        }

        if (event.status && event.status !== "active") {
          throw new Error("Esta feria todavía no está publicada.");
        }

        setCurrentEvent(event);
        setCurrentEventId(event.id);

        const visibility = event.visibility || "public";
        const registrationMode = event.registration_mode || "open";

        const { data: participant, error: participantErr } = await withTimeout(
          supabase
            .from("event_participants")
            .select("id,status")
            .eq("event_id", event.id)
            .eq("user_id", session.user.id)
            .maybeSingle(),
          "No se pudo comprobar tu acceso a la feria."
        );

        let participantStatus = participant?.status as string | undefined;
        const accessTablesReady = !participantErr;
        const invitationToken = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("invite")
          : null;
        const userEmail = session.user.email?.trim().toLowerCase();

        if (participantErr) {
          console.warn("[access] participant tables are not ready yet", participantErr.message);
        }

        const ensureParticipantCapacity = async () => {
          const participantLimit = Number(event.participant_limit || 0);
          if (!participantLimit || !accessTablesReady) return;

          const { count, error: countErr } = await withTimeout(
            supabase
              .from("event_participants")
              .select("id", { count: "exact", head: true })
              .eq("event_id", event.id)
              .in("status", ["registered", "approved", "pending"]),
            "No se pudo comprobar el aforo de la feria."
          );

          if (countErr) throw countErr;
          if ((count || 0) >= participantLimit) {
            throw new Error("El aforo de esta feria esta completo.");
          }
        };

        if (!participantStatus && accessTablesReady && visibility === "public" && registrationMode === "open") {
          await ensureParticipantCapacity();

          const { data: registered, error: registerErr } = await withTimeout(
            supabase
              .from("event_participants")
              .insert({
                event_id: event.id,
                user_id: session.user.id,
                status: "registered",
                source: "self_registration",
              })
              .select("status")
              .single(),
            "No se pudo registrar tu entrada a la feria."
          );

          if (registerErr) throw registerErr;
          participantStatus = registered?.status || "registered";
        } else if (!participantStatus && accessTablesReady && registrationMode === "approval_required") {
          await ensureParticipantCapacity();

          const { data: pending, error: pendingErr } = await withTimeout(
            supabase
              .from("event_participants")
              .insert({
                event_id: event.id,
                user_id: session.user.id,
                status: "pending",
                source: "self_registration",
              })
              .select("status")
              .single(),
            "No se pudo crear tu solicitud de acceso."
          );

          if (pendingErr) throw pendingErr;
          participantStatus = pending?.status || "pending";
        } else if (!participantStatus && accessTablesReady && registrationMode === "invite_only" && userEmail) {
          let invitationQuery = supabase
            .from("event_invitations")
            .select("id,email,status,expires_at")
            .eq("event_id", event.id)
            .eq("status", "pending");

          invitationQuery = invitationToken
            ? invitationQuery.eq("token", invitationToken)
            : invitationQuery.ilike("email", userEmail);

          const { data: invitation, error: invitationErr } = await withTimeout(
            invitationQuery.maybeSingle(),
            "No se pudo comprobar la invitación."
          );

          if (invitationErr) {
            console.warn("[access] invitation check failed", invitationErr.message);
          }

          const invitationEmailMatches = invitation?.email?.trim().toLowerCase() === userEmail;
          const invitationExpired = invitation?.expires_at
            ? new Date(invitation.expires_at).getTime() < Date.now()
            : false;

          if (invitation && invitationEmailMatches && !invitationExpired) {
            const { data: invitedParticipant, error: invitedErr } = await withTimeout(
              supabase
                .from("event_participants")
                .insert({
                  event_id: event.id,
                  user_id: session.user.id,
                  status: "approved",
                  source: "invitation",
                })
                .select("status")
                .single(),
              "No se pudo aceptar la invitación."
            );

            if (invitedErr) throw invitedErr;

            const { error: acceptErr } = await withTimeout(
              supabase
                .from("event_invitations")
                .update({
                  status: "accepted",
                  accepted_by: session.user.id,
                  accepted_at: new Date().toISOString(),
                })
                .eq("id", invitation.id),
              "La invitación fue aceptada, pero no se pudo actualizar su estado."
            );

            if (acceptErr) {
              console.warn("[access] invitation accepted but invitation row was not updated", acceptErr.message);
            }

            participantStatus = invitedParticipant?.status || "approved";
          }
        }

        if (participantStatus === "pending") {
          setAccessStatus("pending");
          return;
        }

        if (participantStatus === "blocked" || (accessTablesReady && !participantStatus && visibility === "private")) {
          setAccessStatus("denied");
          return;
        }

        setAccessStatus("granted");
        trackAnalyticsEvent({
          eventId: event.id,
          action: "fair_entered",
          metadata: { slug },
        });

        const { data: pavilionsData, error: pavErr } = await withTimeout(
          supabase
            .from("pavilions")
            .select("*")
            .eq("event_id", event.id)
            .order("created_at", { ascending: true }),
          "No se pudieron cargar los pabellones."
        );

        if (pavErr) throw pavErr;

        if (pavilionsData && pavilionsData.length > 0) {
          setPavilions(pavilionsData);
          setActivePavilionId((current) => current || pavilionsData[0].id);
        }
      } catch (err: unknown) {
        console.error("Error loading fair:", err);
        setAccessStatus("denied");
        setError(err instanceof Error ? err.message : "Error de conexión");
      } finally {
        setLoading(false);
      }
    }

    fetchFairData();
  }, [slug, mounted, router, setCurrentEvent]);

  useEffect(() => {
    const requestId = standsRequestId.current + 1;
    standsRequestId.current = requestId;
    let cancelled = false;

    async function fetchStands() {
      if (!activePavilionId || accessStatus !== "granted") {
        setStands([]);
        setStandsLoading(false);
        return;
      }

      const cachedStands = standsCache.current.get(activePavilionId);
      if (cachedStands) {
        setStands(cachedStands);
        setStandsLoading(false);
      } else {
        setStands([]);
        setStandsLoading(true);
      }

      trackAnalyticsEvent({
        eventId: currentEventId,
        pavilionId: activePavilionId,
        action: "pavilion_entered",
      });

      const result = await Promise.race([
        supabase
          .from("stands")
          .select("*")
          .eq("pavilion_id", activePavilionId),
        new Promise<{ data: null; error: Error }>((resolve) => {
          window.setTimeout(() => resolve({
            data: null,
            error: new Error("La carga de stands está tardando demasiado."),
          }), 8000);
        }),
      ]);

      if (cancelled || standsRequestId.current !== requestId) return;

      if (result.error) {
        console.error("Error fetching stands:", result.error);
        setStandsLoading(false);
        return;
      }

      if (result.data) {
        const nextStands = result.data as Stand[];
        standsCache.current.set(activePavilionId, nextStands);
        setStands(nextStands);
      }
      setStandsLoading(false);
    }

    fetchStands();

    return () => {
      cancelled = true;
    };
  }, [activePavilionId, accessStatus, currentEventId]);

  useEffect(() => {
    if (view === "auditorium" && accessStatus === "granted") {
      trackAnalyticsEvent({
        eventId: currentEventId,
        action: "auditorium_entered",
      });
    }
  }, [view, accessStatus, currentEventId]);

  const openRecommendedStand = async (recommendation: FairAssistantRecommendation) => {
    if (recommendation.pavilion_id) {
      setActivePavilionId(recommendation.pavilion_id);
      setView("pavilion");
    }

    const cachedStand = recommendation.pavilion_id
      ? standsCache.current.get(recommendation.pavilion_id)?.find((stand) => stand.id === recommendation.id)
      : undefined;

    if (cachedStand) {
      setSelectedStand(cachedStand);
      trackAnalyticsEvent({
        eventId: currentEventId,
        pavilionId: cachedStand.pavilion_id || recommendation.pavilion_id,
        standId: cachedStand.id,
        action: "stand_viewed",
        metadata: { title: cachedStand.title, source: "assistant_recommendation" },
      });
      return;
    }

    const { data, error } = await supabase
      .from("stands")
      .select("*")
      .eq("id", recommendation.id)
      .maybeSingle();

    if (error || !data) {
      console.warn("[assistant] recommended stand could not be opened", error?.message);
      return;
    }

    const stand = data as Stand;
    if (stand.pavilion_id) {
      const nextCache = standsCache.current.get(stand.pavilion_id) || [];
      if (!nextCache.some((item) => item.id === stand.id)) {
        standsCache.current.set(stand.pavilion_id, [...nextCache, stand]);
      }
      setActivePavilionId(stand.pavilion_id);
    }

    setSelectedStand(stand);
    trackAnalyticsEvent({
      eventId: currentEventId,
      pavilionId: stand.pavilion_id || recommendation.pavilion_id,
      standId: stand.id,
      action: "stand_viewed",
      metadata: { title: stand.title, source: "assistant_recommendation" },
    });
  };

  if (error) {
    return (
      <div className="flex bg-[#050505] min-h-[calc(100vh-64px)] w-full items-center justify-center text-white">
        <div className="glass p-12 rounded-3xl text-center max-w-lg border border-red-500/20">
          <h2 className="text-2xl font-black uppercase tracking-widest text-red-400 mb-4">Acceso Denegado</h2>
          <p className="opacity-60">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-primary"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (mounted && loadExpired) {
    return (
      <div className="flex bg-[#050505] min-h-[calc(100vh-64px)] w-full items-center justify-center text-white">
        <div className="glass p-12 rounded-3xl text-center max-w-lg border border-orange-500/20">
          <h2 className="text-2xl font-black uppercase tracking-widest text-orange-400 mb-4">Carga detenida</h2>
          <p className="opacity-60">
            La feria tarda demasiado en responder. Recarga la página o vuelve a iniciar sesión.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 rounded-xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white"
          >
            Recargar feria
          </button>
        </div>
      </div>
    );
  }

  if (!mounted || loading || accessStatus === "checking") {
    return (
      <div className="flex bg-[#050505] min-h-[calc(100vh-64px)] w-full items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-primary border-solid rounded-full animate-spin" />
      </div>
    );
  }

  if (accessStatus === "pending") {
    return (
      <div className="flex bg-[#050505] min-h-[calc(100vh-64px)] w-full items-center justify-center text-white">
        <div className="glass p-12 rounded-3xl text-center max-w-lg border border-yellow-500/20">
          <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-400 mb-4">Solicitud pendiente</h2>
          <p className="opacity-60">Tu acceso a esta feria está pendiente de aprobación por parte del organizador.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-yellow-400 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (accessStatus === "denied") {
    return (
      <div className="flex bg-[#050505] min-h-[calc(100vh-64px)] w-full items-center justify-center text-white">
        <div className="glass p-12 rounded-3xl text-center max-w-lg border border-red-500/20">
          <h2 className="text-2xl font-black uppercase tracking-widest text-red-400 mb-4">Acceso privado</h2>
          <p className="opacity-60">Esta feria requiere invitación o aprobación previa.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-primary"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full bg-[#050505]">
      {view === "pavilion" && pavilions.length > 0 && (
        <div className="fixed left-8 top-1/2 -translate-y-1/2 z-40 flex flex-col items-start gap-4 h-auto max-h-[70vh]">
          <div className="flex flex-col gap-1 mb-2">
            <span className="text-[8px] uppercase tracking-[0.4em] font-black text-white/30 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
              <MapIcon size={10} className="text-primary" /> Pabellones
            </span>
          </div>

          <div className="flex flex-col gap-3 glass p-3 rounded-[2rem] border border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.3)] backdrop-blur-3xl overflow-y-auto scrollbar-hide">
            {pavilions.map((pav) => (
              <button
                key={pav.id}
                onClick={() => {
                  setActivePavilionId(pav.id);
                  if (view !== "pavilion") setView("pavilion");
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-[10px] font-black uppercase transition-all duration-300 relative group ${
                  activePavilionId === pav.id
                    ? "bg-primary text-black shadow-[0_0_25px_rgba(255,81,0,0.4)] scale-110"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                }`}
                title={pav.name}
              >
                <span className="truncate px-1">{pav.name.substring(0, 2).toUpperCase()}</span>

                <div className="absolute left-16 px-4 py-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl text-white text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-2xl">
                  {pav.name}
                </div>

                {activePavilionId === pav.id && (
                  <div className="absolute -left-1 w-1 h-6 bg-primary rounded-full shadow-[0_0_10px_#ff5100]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed top-24 right-8 z-40 flex items-center gap-2 glass p-2 rounded-2xl border border-white/10">
        <button
          onClick={() => setView("pavilion")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === "pavilion" ? "bg-primary text-black" : "hover:bg-white/5 text-white/50 hover:text-white"}`}
        >
          Zona de Exposición
        </button>
        <button
          onClick={() => setView("auditorium")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === "auditorium" ? "bg-primary text-black" : "hover:bg-white/5 text-white/50 hover:text-white"}`}
        >
          Auditorio Principal
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === "pavilion" && (
          <motion.div
            key={`pavilion-${activePavilionId}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="w-full h-full"
          >
            <Pavilion
              stands={stands}
              pavilionName={pavilions.find((p) => p.id === activePavilionId)?.name}
              isLoading={standsLoading}
              onStandClick={(stand) => {
                trackAnalyticsEvent({
                  eventId: currentEventId,
                  pavilionId: activePavilionId,
                  standId: stand.id,
                  action: "stand_viewed",
                  metadata: { title: stand.title },
                });
                setSelectedStand(stand);
              }}
            />
          </motion.div>
        )}

        {view === "auditorium" && (
          <motion.div
            key="auditorium"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Auditorium />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {view === "stand" && selectedStand && (
          <StandDetail stand={selectedStand} onClose={() => setSelectedStand(null)} />
        )}
      </AnimatePresence>

      <FairAssistant
        slug={String(slug)}
        eventId={currentEventId}
        onOpenStand={openRecommendedStand}
        onAnalytics={(question, mode) => {
          trackAnalyticsEvent({
            eventId: currentEventId,
            action: "chat_message_sent",
            metadata: { question, assistant_mode: mode || "unknown" },
          });
        }}
      />

      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/5 blur-[150px] rounded-full animate-pulse [animation-delay:2s]" />
      </div>
    </div>
  );
}
