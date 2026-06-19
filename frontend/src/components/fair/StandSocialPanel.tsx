"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, User, Users, BellRing, Loader2 } from "lucide-react";
import { Stand } from "@/../../shared";
import { supabase } from "@/lib/supabase";
import { usePresence } from "@/context/PresenceProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";

interface Message {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  room: string;
  created_at: string;
}

interface StandSocialPanelProps {
  stand: Stand;
}

export default function StandSocialPanel({ stand }: StandSocialPanelProps) {
  const { presences, userId } = usePresence();
  const room = `stand:${stand.id}`;
  const attendees = (presences[stand.id] || []).filter((presence, index, list) => (
    list.findIndex((item) => item.user_id === presence.user_id) === index
  ));
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [attentionStatus, setAttentionStatus] = useState<string | null>(null);
  const [isRequestingAttention, setIsRequestingAttention] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) => {
            window.setTimeout(() => resolve({ data: { session: null } }), 3500);
          }),
        ]);

        if (cancelled) return;

        if (session?.user) {
          setCurrentUser({ id: session.user.id, email: session.user.email || undefined });
          return;
        }

        if (userId && !userId.startsWith("guest_")) {
          setCurrentUser({ id: userId });
        }
      } catch (error) {
        console.warn("[stand-chat] user session unavailable", error);
        if (!cancelled && userId && !userId.startsWith("guest_")) {
          setCurrentUser({ id: userId });
        }
      }
    }

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room", room)
        .order("created_at", { ascending: true })
        .limit(60);

      if (data) setMessages(data as Message[]);
      if (error) console.warn("[stand-chat] messages unavailable", error.message);
    }

    fetchUser();
    fetchMessages();

    const pollInterval = window.setInterval(fetchMessages, 3000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ? { id: session.user.id, email: session.user.email || undefined } : null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearInterval(pollInterval);
    };
  }, [room, userId]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    const content = newMessage.trim();
    if (!content || !currentUser || isSending) return;

    setIsSending(true);
    setNewMessage("");
    const optimisticMessage: Message = {
      id: `local-${Date.now()}`,
      user_id: currentUser.id,
      user_name: currentUser.email?.split("@")[0] || "Visitante",
      content,
      room,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 0);
    window.setTimeout(() => setIsSending(false), 150);

    void (async () => {
      const { error } = await insertMessageWithTimeout({
        userId: currentUser.id,
        userName: currentUser.email?.split("@")[0] || "Visitante",
        content,
        room,
      });

      if (error) {
        setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
        setNewMessage((current) => current || content);
        console.warn("[stand-chat] send failed", error.message);
        return;
      }

      trackAnalyticsEvent({
        eventId: stand.event_id,
        standId: stand.id,
        action: "chat_message_sent",
        metadata: { room, stand_title: stand.title },
      });
    })();
  };

  const requestAttention = async () => {
    if (!currentUser || isRequestingAttention) return;

    setIsRequestingAttention(true);
    setAttentionStatus(null);

    const metadata = {
      stand_title: stand.title,
      requested_from: "stand_social_panel",
      online_attendees: attendees.length,
    };

    const { error } = await supabase.from("stand_leads").insert({
      event_id: stand.event_id,
      stand_id: stand.id,
      user_id: currentUser.id,
      action: "attention_requested",
      metadata,
    });

    trackAnalyticsEvent({
      eventId: stand.event_id,
      standId: stand.id,
      action: "stand_cta_clicked",
      metadata: { ...metadata, cta: "attention_requested" },
    });

    setAttentionStatus(error ? "No se pudo avisar al expositor. Prueba con el chat o WhatsApp." : "Solicitud enviada. El expositor verá tu aviso como lead del stand.");
    setIsRequestingAttention(false);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <header className="border-b border-slate-100 bg-slate-950 p-5 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-black">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-orange-400">En este stand</p>
              <h3 className="text-sm font-black uppercase tracking-normal">Asistentes y chat</h3>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black text-white/60">
            {attendees.length}
          </span>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ahora visitando</p>
            <button
              onClick={requestAttention}
              disabled={!currentUser || isRequestingAttention}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRequestingAttention ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
              Solicitar atención
            </button>
          </div>

          {attendees.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {attendees.slice(0, 6).map((attendee) => {
                const isMe = attendee.user_id === userId;
                return (
                  <div key={attendee.user_id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
                        <User size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase tracking-wide text-slate-700">
                          {attendee.user_name}{isMe ? " (tú)" : ""}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          {attendee.status === "viewing" ? "viendo stand" : "disponible"}
                        </p>
                      </div>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Aún no hay otros visitantes detectados en este stand.
            </div>
          )}

          {attentionStatus && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs font-bold leading-5 text-orange-800">
              {attentionStatus}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <MessageCircle size={14} className="text-orange-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chat público del stand</p>
          </div>

          <div className="max-h-64 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-slate-400">
                Sé el primero en preguntar algo sobre este stand.
              </p>
            ) : (
              messages.map((message) => {
                const isMe = message.user_id === currentUser?.id;
                return (
                  <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      isMe ? "bg-orange-600 text-white" : "border border-slate-200 bg-white text-slate-700"
                    }`}>
                      <p className={`mb-1 text-[9px] font-black uppercase tracking-widest ${isMe ? "text-white/65" : "text-slate-400"}`}>
                        {message.user_name}
                      </p>
                      <p>{message.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-slate-200 p-3">
            <input
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              disabled={!currentUser || isSending}
              placeholder={currentUser ? "Escribe al stand..." : "Inicia sesión para escribir..."}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !currentUser || isSending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
              title="Enviar mensaje"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

async function insertMessageWithTimeout({
  userId,
  userName,
  content,
  room,
}: {
  userId: string;
  userName: string;
  content: string;
  room: string;
}) {
  return Promise.race([
    supabase.from("messages").insert({
      user_id: userId,
      user_name: userName,
      content,
      room,
    }),
    new Promise<{ error: Error }>((resolve) => {
      window.setTimeout(() => resolve({ error: new Error("El mensaje está tardando demasiado en sincronizar.") }), 4500);
    }),
  ]);
}
