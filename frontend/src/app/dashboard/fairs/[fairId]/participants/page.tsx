"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, Mail, RefreshCcw, Send, UserX, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Participant {
  id: string;
  status: "registered" | "pending" | "approved" | "blocked";
  created_at: string;
  profiles?: {
    email?: string | null;
  } | null;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string | null;
  created_at: string;
}

interface FairAccessConfig {
  title: string;
  slug: string | null;
  visibility: "public" | "private";
  registration_mode: "open" | "approval_required" | "invite_only";
  participant_limit: number | null;
}

export default function FairParticipantsPage() {
  const { fairId } = useParams();
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fair, setFair] = useState<FairAccessConfig | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Participant["status"] | "all">("all");

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const loadAccessData = useCallback(async () => {
    setLoading(true);
    const [fairResult, participantsResult, invitationsResult] = await Promise.all([
      supabase
        .from("events")
        .select("title,slug,visibility,registration_mode,participant_limit")
        .eq("id", fairId)
        .single(),
      supabase
        .from("event_participants")
        .select("id,status,created_at,profiles(email)")
        .eq("event_id", fairId)
        .order("created_at", { ascending: false }),
      supabase
        .from("event_invitations")
        .select("id,email,token,status,expires_at,created_at")
        .eq("event_id", fairId)
        .order("created_at", { ascending: false }),
    ]);

    if (fairResult.error) {
      console.error("Error loading fair:", fairResult.error);
      showNotice("No se pudo cargar la configuracion de acceso.");
    } else {
      const data = fairResult.data;
      setFair({
        title: data?.title || "Feria",
        slug: data?.slug || null,
        visibility: data?.visibility || "public",
        registration_mode: data?.registration_mode || "open",
        participant_limit: data?.participant_limit || null,
      });
    }

    if (participantsResult.error) {
      console.error("Error loading participants:", participantsResult.error);
      showNotice("No se pudieron cargar los participantes.");
    } else {
      setParticipants((participantsResult.data || []) as Participant[]);
    }

    if (invitationsResult.error) {
      console.error("Error loading invitations:", invitationsResult.error);
      showNotice("No se pudieron cargar las invitaciones.");
    } else {
      setInvitations((invitationsResult.data || []) as Invitation[]);
    }
    setLoading(false);
  }, [fairId, showNotice]);

  useEffect(() => {
    let ignore = false;

    loadAccessData().then(() => {
      if (ignore) return;
    });

    return () => {
      ignore = true;
    };
  }, [loadAccessData]);

  const updateStatus = async (participantId: string, status: Participant["status"]) => {
    const { error } = await supabase
      .from("event_participants")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", participantId);

    if (error) {
      showNotice(`No se pudo actualizar: ${error.message}`);
      return;
    }

    setParticipants((current) => current.map((participant) => participant.id === participantId ? { ...participant, status } : participant));
    showNotice("Estado actualizado.");
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setCreatingInvite(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data, error } = await supabase
      .from("event_invitations")
      .insert({
        event_id: fairId,
        email,
        expires_at: expiresAt.toISOString(),
      })
      .select("id,email,token,status,expires_at,created_at")
      .single();

    setCreatingInvite(false);

    if (error) {
      showNotice(`No se pudo crear la invitacion: ${error.message}`);
      return;
    }

    setInviteEmail("");
    setInvitations((current) => [data as Invitation, ...current]);
    showNotice("Invitacion creada. Ya puedes copiar el enlace.");
  };

  const copyFairLink = async (token?: string) => {
    if (!fair?.slug) {
      showNotice("La feria no tiene slug configurado.");
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const link = `${origin}/expo/${fair.slug}${token ? `?invite=${token}` : ""}`;
    await navigator.clipboard.writeText(link);
    showNotice(token ? "Enlace privado copiado." : "Enlace de feria copiado.");
  };

  const revokeInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from("event_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId);

    if (error) {
      showNotice(`No se pudo revocar: ${error.message}`);
      return;
    }

    setInvitations((current) => current.map((invitation) => (
      invitation.id === invitationId ? { ...invitation, status: "revoked" } : invitation
    )));
    showNotice("Invitacion revocada.");
  };

  const counts = useMemo(() => ({
    total: participants.length,
    active: participants.filter((participant) => participant.status === "registered" || participant.status === "approved").length,
    pending: participants.filter((participant) => participant.status === "pending").length,
    blocked: participants.filter((participant) => participant.status === "blocked").length,
    invited: invitations.filter((invitation) => invitation.status === "pending").length,
  }), [participants, invitations]);

  const filteredParticipants = filter === "all"
    ? participants
    : participants.filter((participant) => participant.status === filter);

  const capacityLabel = fair?.participant_limit
    ? `${counts.active}/${fair.participant_limit}`
    : `${counts.active}`;
  const isCapacityFull = Boolean(fair?.participant_limit && counts.active >= fair.participant_limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {notice && (
        <div className="fixed right-6 top-24 z-50 max-w-sm rounded-2xl border border-primary/30 bg-black/90 px-5 py-4 text-sm font-bold text-white shadow-2xl">
          {notice}
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/fairs")} className="p-3 glass rounded-xl text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Participantes</h1>
            <p className="text-white/40">{fair?.title || "Gestion de accesos"} · {counts.pending} solicitudes pendientes</p>
          </div>
        </div>
        <button
          onClick={loadAccessData}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 transition hover:border-primary/50 hover:text-white"
        >
          <RefreshCcw size={14} />
          Actualizar
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <AccessMetric label="Aforo usado" value={capacityLabel} tone={isCapacityFull ? "red" : "green"} />
        <AccessMetric label="Pendientes" value={counts.pending} tone={counts.pending ? "yellow" : "muted"} />
        <AccessMetric label="Bloqueados" value={counts.blocked} tone={counts.blocked ? "red" : "muted"} />
        <AccessMetric label="Invitaciones" value={counts.invited} tone={counts.invited ? "orange" : "muted"} />
      </section>

      <section className="glass rounded-[2rem] border border-white/5 p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Configuracion actual</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">{accessModeLabel(fair)}</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">{accessModeDescription(fair)}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => copyFairLink()}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white"
            >
              <Copy size={14} />
              Copiar enlace feria
            </button>
            {fair?.slug && (
              <a
                href={`/expo/${fair.slug}`}
                target="_blank"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/70 transition hover:border-white/30 hover:text-white"
              >
                <ExternalLink size={14} />
                Abrir
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="glass rounded-[2rem] border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">Accesos a la feria</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "registered", "approved", "pending", "blocked"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition ${filter === item ? "border-primary bg-primary text-black" : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white"}`}
              >
                {item === "all" ? "Todos" : item}
              </button>
            ))}
          </div>
        </div>

        {filteredParticipants.length === 0 ? (
          <div className="p-12 text-center text-white/30">Todavia no hay participantes registrados.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredParticipants.map((participant) => (
              <div key={participant.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold">{participant.profiles?.email || "Usuario sin email visible"}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">{new Date(participant.created_at).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusClass(participant.status)}`}>
                    {participant.status}
                  </span>
                  <button
                    onClick={() => updateStatus(participant.id, "approved")}
                    className="p-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black transition-colors"
                    title="Aprobar"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => updateStatus(participant.id, "blocked")}
                    className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                    title="Bloquear"
                  >
                    <UserX size={16} />
                  </button>
                  {participant.status === "blocked" && (
                    <button
                      onClick={() => updateStatus(participant.id, "registered")}
                      className="p-3 rounded-xl bg-white/5 text-white/60 hover:bg-white hover:text-black transition-colors"
                      title="Reactivar"
                    >
                      <RefreshCcw size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-[2rem] border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <Mail size={18} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest">Invitaciones privadas</h2>
        </div>

        <form onSubmit={createInvitation} className="p-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-b border-white/5">
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="email@empresa.com"
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={creatingInvite}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            <Send size={14} />
            {creatingInvite ? "Creando" : "Crear invitacion"}
          </button>
        </form>

        {invitations.length === 0 ? (
          <div className="p-12 text-center text-white/30">Todavia no hay invitaciones creadas.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold">{invitation.email}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">
                    {invitation.expires_at ? `Expira ${new Date(invitation.expires_at).toLocaleDateString()}` : "Sin caducidad"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${invitationStatusClass(invitation.status)}`}>
                    {invitation.status}
                  </span>
                  <button
                    onClick={() => copyFairLink(invitation.token)}
                    className="p-3 rounded-xl bg-white/5 text-white/60 hover:bg-primary hover:text-black transition-colors"
                    title="Copiar enlace de invitacion"
                  >
                    <Copy size={16} />
                  </button>
                  {invitation.status === "pending" && (
                    <button
                      onClick={() => revokeInvitation(invitation.id)}
                      className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                      title="Revocar invitacion"
                    >
                      <UserX size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-white/55">
        En ferias publicas abiertas, el participante queda asociado cuando entra por el enlace exacto de la feria.
        En ferias privadas, usa aprobacion o invitaciones para controlar quien entra.
      </div>
    </div>
  );
}

function AccessMetric({ label, value, tone }: { label: string; value: string | number; tone: "green" | "yellow" | "red" | "orange" | "muted" }) {
  const toneClass = {
    green: "text-green-400 border-green-500/20 bg-green-500/10",
    yellow: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
    red: "text-red-400 border-red-500/20 bg-red-500/10",
    orange: "text-primary border-primary/20 bg-primary/10",
    muted: "text-white/45 border-white/10 bg-white/[0.03]",
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function accessModeLabel(fair: FairAccessConfig | null) {
  if (!fair) return "Acceso no configurado";
  if (fair.visibility === "public" && fair.registration_mode === "open") return "Publica abierta";
  if (fair.registration_mode === "approval_required") return "Privada con aprobacion";
  if (fair.registration_mode === "invite_only") return "Solo invitacion";
  return "Acceso personalizado";
}

function accessModeDescription(fair: FairAccessConfig | null) {
  if (!fair) return "No se pudo leer la configuracion de esta feria.";
  if (fair.visibility === "public" && fair.registration_mode === "open") {
    return "Cualquier persona con el enlace puede crear cuenta y queda asociada automaticamente a esta feria.";
  }
  if (fair.registration_mode === "approval_required") {
    return "Los participantes pueden solicitar acceso, pero no entran hasta que los apruebes.";
  }
  if (fair.registration_mode === "invite_only") {
    return "Solo entran emails invitados o usuarios con enlace privado de invitacion.";
  }
  return "Revisa los ajustes de la feria para confirmar como se admiten participantes.";
}

function statusClass(status: Participant["status"]) {
  if (status === "approved" || status === "registered") return "bg-green-500/10 text-green-400 border-green-500/20";
  if (status === "pending") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}

function invitationStatusClass(status: Invitation["status"]) {
  if (status === "accepted") return "bg-green-500/10 text-green-400 border-green-500/20";
  if (status === "pending") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}
