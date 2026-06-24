"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Bell, Eye, MousePointerClick, Store, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getDashboardAccess } from "@/lib/dashboardAccess";

interface DashboardMetrics {
  fairEntries: number;
  standViews: number;
  leads: number;
  participants: number;
}

interface RecentActivity {
  id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const DASHBOARD_METRICS_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = DASHBOARD_METRICS_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    fairEntries: 0,
    standViews: 0,
    leads: 0,
    participants: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
    });
  }, []);

  useEffect(() => {
    async function loadRealMetrics() {
      try {
        const access = await getDashboardAccess();
        const isAdmin = Boolean(access?.isAdmin);
        const managedFairIds = access?.managedFairIds || [];

        if (!isAdmin && managedFairIds.length === 0) {
          setMetrics({ fairEntries: 0, standViews: 0, leads: 0, participants: 0 });
          setRecentActivity([]);
          return;
        }

        const summaryQuery = supabase
          .from("fair_analytics_summary")
          .select("event_id,fair_entries,stand_views,leads,registered_participants");

        const activityQuery = supabase
          .from("analytics_events")
          .select("id,event_id,action,metadata,created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        const [{ data: summaries }, { data: activity }] = await Promise.all([
          withTimeout(
            isAdmin ? summaryQuery : summaryQuery.in("event_id", managedFairIds),
            "Dashboard summary metrics"
          ),
          withTimeout(
            isAdmin ? activityQuery : activityQuery.in("event_id", managedFairIds),
            "Dashboard recent activity"
          ),
        ]);

        setMetrics({
          fairEntries: (summaries || []).reduce((total, item) => total + Number(item.fair_entries || 0), 0),
          standViews: (summaries || []).reduce((total, item) => total + Number(item.stand_views || 0), 0),
          leads: (summaries || []).reduce((total, item) => total + Number(item.leads || 0), 0),
          participants: (summaries || []).reduce((total, item) => total + Number(item.registered_participants || 0), 0),
        });

        setRecentActivity((activity || []) as RecentActivity[]);
      } catch (error) {
        console.warn("[dashboard] real metrics unavailable", error);
      } finally {
        setLoadingMetrics(false);
      }
    }

    loadRealMetrics();
  }, []);

  return (
    <div className="space-y-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-black uppercase tracking-tight">
            Bienvenido, {userEmail ? userEmail.split("@")[0] : "..."}
          </h1>
          <p className="font-medium text-white/40">Panel de control de ievents+</p>
        </div>
        <div className="flex items-center gap-6">
          <button className="glass relative rounded-2xl border border-white/5 p-4" title="Notificaciones">
            <Bell size={20} className="text-white/60" />
            <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,242,255,0.8)]" />
          </button>
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 text-xl font-black text-primary">
              {userEmail?.charAt(0).toUpperCase() || "?"}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <StatCard label="Entradas feria" value={metrics.fairEntries} loading={loadingMetrics} icon={<Eye className="text-primary" />} />
        <StatCard label="Vistas stands" value={metrics.standViews} loading={loadingMetrics} icon={<Store className="text-secondary" />} />
        <StatCard label="Leads reales" value={metrics.leads} loading={loadingMetrics} icon={<MousePointerClick className="text-primary" />} />
        <StatCard label="Participantes" value={metrics.participants} loading={loadingMetrics} icon={<Users className="text-secondary" />} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="glass rounded-[2.5rem] border border-white/5 p-10">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-xl font-bold uppercase tracking-widest">Estado de datos</h3>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-primary">
                Sin datos ficticios
              </span>
            </div>
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-black/40">
              <div className="relative z-10 flex max-w-md flex-col items-center gap-4 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/40 bg-primary/20">
                  <BarChart3 size={40} className="text-primary" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-primary/80">Analítica real</p>
                  <p className="text-sm leading-6 text-white/40">
                    Este panel solo suma eventos registrados por visitantes, stands, leads y participantes reales.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="glass rounded-[2.5rem] border border-white/5 p-8">
            <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-primary">Actividad real reciente</h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-sm leading-6 text-white/40">
                Todavía no hay actividad registrada. Cuando entren visitantes, abran stands o usen la IA, aparecerá aquí.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, icon }: { label: string; value: number; loading: boolean; icon: ReactNode }) {
  return (
    <div className="glass rounded-3xl border border-white/5 p-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl border border-white/5 bg-white/5 p-3">{icon}</div>
        <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-black text-white/35">REAL</span>
      </div>
      <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</h3>
      <p className="text-3xl font-black tracking-tight">{loading ? "..." : value.toLocaleString()}</p>
    </div>
  );
}

function ActivityItem({ activity }: { activity: RecentActivity }) {
  const label = getActivityLabel(activity);
  const date = new Date(activity.created_at);

  return (
    <div className="group flex gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-white/5 hover:bg-white/5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-colors group-hover:text-primary">
        <BarChart3 size={16} />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-bold">{label.title}</span>
          <span className="text-[10px] text-white/20">
            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="w-40 truncate text-[11px] text-white/40">{label.detail}</p>
      </div>
    </div>
  );
}

function getActivityLabel(activity: RecentActivity) {
  const title = activity.action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const question = typeof activity.metadata?.question === "string" ? activity.metadata.question : null;
  const standTitle = typeof activity.metadata?.title === "string" ? activity.metadata.title : null;

  return {
    title,
    detail: question || standTitle || "Evento registrado en la plataforma",
  };
}
