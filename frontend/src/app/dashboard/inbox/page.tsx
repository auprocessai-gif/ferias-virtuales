"use client";

import { useEffect, useState } from "react";
import { BellRing, ExternalLink, Store } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getDashboardAccess } from "@/lib/dashboardAccess";

interface EventLink {
  id: string;
  title: string | null;
  slug: string | null;
}

export default function DashboardInboxIndexPage() {
  const [events, setEvents] = useState<EventLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const access = await getDashboardAccess();

        if (access?.isAdmin) {
          const { data } = await supabase
            .from("events")
            .select("id,title,slug")
            .order("created_at", { ascending: false });
          setEvents((data || []) as EventLink[]);
          return;
        }

        if (access?.managedFairIds.length) {
          const eventIds = access.managedFairIds;
          if (eventIds.length === 0) return;

          const { data } = await supabase
            .from("events")
            .select("id,title,slug")
            .in("id", eventIds)
            .order("created_at", { ascending: false });
          setEvents((data || []) as EventLink[]);
          return;
        }

        const { data: stands } = await supabase
          .from("stands")
          .select("event_id,events(id,title,slug)")
          .eq("user_id", session.user.id);

        const uniqueEvents = new Map<string, EventLink>();
        (stands || []).forEach((stand) => {
          const event = Array.isArray(stand.events) ? stand.events[0] : stand.events;
          if (event?.id) uniqueEvents.set(event.id, event as EventLink);
        });
        setEvents(Array.from(uniqueEvents.values()));
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tight">Bandeja</h1>
        <p className="mt-2 text-white/40">Solicitudes de atención, leads y mensajes por feria.</p>
      </header>

      {events.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/dashboard/fairs/${event.id}/inbox`}
              className="glass group rounded-[2rem] border border-white/5 p-7 transition hover:border-primary/30"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BellRing size={22} />
                </div>
                <ExternalLink size={18} className="text-white/25 transition group-hover:text-primary" />
              </div>
              <h2 className="text-lg font-black uppercase tracking-widest">{event.title || "Feria sin título"}</h2>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/30">/{event.slug || "sin-slug"}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/25">
            <Store size={28} />
          </div>
          <h3 className="text-lg font-black uppercase tracking-widest">No hay ferias con bandeja</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/35">
            Cuando tengas una feria asignada o un stand vinculado, podrás ver aquí sus solicitudes.
          </p>
        </div>
      )}
    </div>
  );
}
