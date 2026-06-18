"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Mail, ShieldAlert, Send, UserX, Users } from "lucide-react";
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

export default function FairParticipantsPage() {
  const { fairId } = useParams();
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fairSlug, setFairSlug] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadParticipants = async () => {
      setLoading(true);
      const [fairResult, participantsResult, invitationsResult] = await Promise.all([
        supabase
          .from("events")
          .select("slug")
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

      if (ignore) return;

      if (fairResult.error) {
        console.error("Error loading fair:", fairResult.error);
      } else {
        setFairSlug(fairResult.data?.slug || null);
      }

      if (participantsResult.error) {
        console.error("Error loading participants:", participantsResult.error);
      } else {
        setParticipants((participantsResult.data || []) as Participant[]);
      }

      if (invitationsResult.error) {
        console.error("Error loading invitations:", invitationsResult.error);
      } else {
        setInvitations((invitationsResult.data || []) as Invitation[]);
      }
      setLoading(false);
    };

    loadParticipants();

    return () => {
      ignore = true;
    };
  }, [fairId]);

  const updateStatus = async (participantId: string, status: Participant["status"]) => {
    const { error } = await supabase
      .from("event_participants")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", participantId);

    if (error) {
      alert(`No se pudo actualizar: ${error.message}`);
      return;
    }

    setParticipants((current) => current.map((participant) => participant.id === participantId ? { ...participant, status } : participant));
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
      alert(`No se pudo crear la invitacion: ${error.message}`);
      return;
    }

    setInviteEmail("");
    setInvitations((current) => [data as Invitation, ...current]);
  };

  const copyInvitationLink = async (token: string) => {
    if (!fairSlug) {
      alert("La feria no tiene slug configurado.");
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const link = `${origin}/expo/${fairSlug}?invite=${token}`;
    await navigator.clipboard.writeText(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = participants.filter((participant) => participant.status === "pending").length;

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/fairs")} className="p-3 glass rounded-xl text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Participantes</h1>
            <p className="text-white/40">{pendingCount} solicitudes pendientes</p>
          </div>
        </div>
      </header>

      <section className="glass rounded-[2rem] border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <Users size={18} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest">Accesos a la feria</h2>
        </div>

        {participants.length === 0 ? (
          <div className="p-12 text-center text-white/30">Todavia no hay participantes registrados.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {participants.map((participant) => (
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
                    onClick={() => copyInvitationLink(invitation.token)}
                    className="p-3 rounded-xl bg-white/5 text-white/60 hover:bg-primary hover:text-black transition-colors"
                    title="Copiar enlace de invitacion"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 flex gap-3 text-yellow-100">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-100/80">En ferias privadas con aprobacion, los usuarios en estado pending no podran entrar hasta que los apruebes.</p>
      </div>
    </div>
  );
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
