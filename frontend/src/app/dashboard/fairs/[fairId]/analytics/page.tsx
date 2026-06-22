"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, ArrowLeft, BarChart3, Bot, Building2, CheckCircle2, ClipboardList, Clock, Eye, Lightbulb, Loader2, MousePointerClick, PlusCircle, Send, ShieldAlert, Store, Target, Trophy, UserRound, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface FairSummary {
  event_id: string;
  event_title: string;
  slug: string;
  fair_entries: number;
  unique_visitors: number;
  pavilion_entries: number;
  stand_views: number;
  auditorium_entries: number;
  leads: number;
  registered_participants: number;
}

interface PavilionSummary {
  pavilion_id: string;
  pavilion_name: string;
  visits: number;
  unique_visitors: number;
}

interface StandSummary {
  stand_id: string;
  event_id?: string;
  stand_title: string;
  views: number;
  unique_visitors: number;
  leads: number;
}

interface StandContact {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website_url: string | null;
}

interface StandLead {
  id: string;
  stand_id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface ParticipantActivity {
  id: string;
  user_id: string | null;
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  user_email?: string | null;
  stand_title?: string | null;
  pavilion_name?: string | null;
}

interface AnalyticsInsights {
  summary: string;
  opportunities: string[];
  risks: string[];
  next_actions: string[];
}

interface ExhibitorTask {
  id: string;
  event_id: string;
  stand_id: string | null;
  type: "reply" | "faq" | "improvement";
  status: "todo" | "done";
  title: string;
  stand_title: string | null;
  detail: string;
  suggested_text?: string | null;
  created_at: string;
  completed_at: string | null;
}

type OpportunityStatus = "new" | "contact_pending" | "contacted" | "interested" | "meeting_scheduled" | "won" | "lost";

interface CommercialOpportunity {
  id: string;
  event_id: string;
  stand_id: string;
  status: OpportunityStatus;
  priority: "low" | "medium" | "high";
  title: string;
  stand_title: string | null;
  contact_label: string | null;
  updated_at: string;
}

interface CommercialAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  stand_title?: string | null;
  stand_id?: string | null;
  task_type?: "reply" | "faq" | "improvement";
  suggested_text?: string;
  can_create_task?: boolean;
}

type AdminAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type ActivityFilter = "all" | "stand_viewed" | "pavilion_entered" | "fair_entered" | "auditorium_entered";

const activityFilters: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "stand_viewed", label: "Stands" },
  { value: "pavilion_entered", label: "Pabellones" },
  { value: "fair_entered", label: "Feria" },
  { value: "auditorium_entered", label: "Auditorio" },
];

const adminSuggestions = [
  "Que stand debo potenciar primero?",
  "Como genero mas leads?",
  "Que pabellon necesita revision?",
  "Que acciones haria esta semana?",
];

const pipelineColumns: Array<{ status: OpportunityStatus; label: string }> = [
  { status: "new", label: "Nuevos" },
  { status: "contact_pending", label: "Contactar" },
  { status: "contacted", label: "Contactados" },
  { status: "interested", label: "Interesados" },
  { status: "meeting_scheduled", label: "Reunion" },
  { status: "won", label: "Ganado" },
  { status: "lost", label: "Perdido" },
];

function buildCommercialAlerts({
  leads,
  tasks,
  stands,
  standContacts,
}: {
  leads: StandLead[];
  tasks: ExhibitorTask[];
  stands: StandSummary[];
  standContacts: StandContact[];
}): CommercialAlert[] {
  const alerts: CommercialAlert[] = [];
  const pendingTasks = tasks.filter((task) => task.status === "todo");
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const standTitleById = new Map<string, string>();

  standContacts.forEach((stand) => {
    standTitleById.set(stand.id, stand.title || "Stand sin titulo");
  });
  stands.forEach((stand) => {
    standTitleById.set(stand.stand_id, stand.stand_title || "Stand sin titulo");
  });

  const taskStandKeys = new Set(
    tasks
      .map((task) => task.stand_id || task.stand_title || "")
      .filter(Boolean)
  );
  const leadStands = new Map<string, StandLead[]>();

  leads.forEach((lead) => {
    const current = leadStands.get(lead.stand_id) || [];
    leadStands.set(lead.stand_id, [...current, lead]);
  });

  leadStands.forEach((standLeads, standId) => {
    const standTitle = standTitleById.get(standId) || "Stand sin titulo";
    const hasTask = taskStandKeys.has(standId) || taskStandKeys.has(standTitle);
    if (!hasTask) {
      alerts.push({
        id: `lead-no-task-${standId}`,
        severity: "critical",
        title: "Leads sin tarea comercial",
        stand_id: standId,
        stand_title: standTitle,
        detail: `${standLeads.length} lead(s) registrados en este stand, pero no hay tareas IA asociadas para seguimiento.`,
        task_type: "reply",
        suggested_text: `Responder los ${standLeads.length} lead(s) de ${standTitle}. Revisar datos del visitante, contactar y marcar seguimiento como hecho.`,
        can_create_task: true,
      });
    }
  });

  pendingTasks
    .filter((task) => now - new Date(task.created_at).getTime() > dayMs)
    .slice(0, 5)
    .forEach((task) => {
      alerts.push({
        id: `old-task-${task.id}`,
        severity: "warning",
        title: "Tarea pendiente mas de 24h",
        stand_id: task.stand_id,
        stand_title: task.stand_title,
        detail: `${task.title} sigue pendiente desde ${new Date(task.created_at).toLocaleString()}.`,
        can_create_task: false,
      });
    });

  stands
    .filter((stand) => stand.views > 0 && stand.leads === 0)
    .slice(0, 5)
    .forEach((stand) => {
      alerts.push({
        id: `views-no-leads-${stand.stand_id}`,
        severity: "warning",
        title: "Visitas sin conversion",
        stand_id: stand.stand_id,
        stand_title: stand.stand_title,
        detail: `${stand.views} vistas y 0 leads. Conviene revisar CTA, datos de contacto y mensaje principal.`,
        task_type: "improvement",
        suggested_text: `Revisar el stand ${stand.stand_title}: mejorar CTA, publicar contacto visible y ajustar mensaje principal para convertir visitas en leads.`,
        can_create_task: true,
      });
    });

  standContacts
    .filter((stand) => !stand.email && !stand.phone && !stand.whatsapp && !stand.website_url)
    .slice(0, 5)
    .forEach((stand) => {
      alerts.push({
        id: `no-contact-${stand.id}`,
        severity: "info",
        title: "Stand sin contacto publicado",
        stand_id: stand.id,
        stand_title: stand.title || "Stand sin titulo",
        detail: "No tiene email, telefono, WhatsApp ni web. Puede perder oportunidades aunque reciba visitas.",
        task_type: "improvement",
        suggested_text: `Completar datos de contacto de ${stand.title || "este stand"}: publicar al menos email o WhatsApp y un CTA claro para hablar con el equipo.`,
        can_create_task: true,
      });
    });

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy",
      severity: "info",
      title: "Seguimiento bajo control",
      detail: "No hay alertas comerciales criticas con los datos actuales.",
      can_create_task: false,
    });
  }

  return alerts.slice(0, 8);
}

export default function FairAnalyticsPage() {
  const { fairId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FairSummary | null>(null);
  const [pavilions, setPavilions] = useState<PavilionSummary[]>([]);
  const [stands, setStands] = useState<StandSummary[]>([]);
  const [standContacts, setStandContacts] = useState<StandContact[]>([]);
  const [leads, setLeads] = useState<StandLead[]>([]);
  const [activityEvents, setActivityEvents] = useState<ParticipantActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [tasks, setTasks] = useState<ExhibitorTask[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [insightsMode, setInsightsMode] = useState<string | null>(null);
  const [adminQuestion, setAdminQuestion] = useState("");
  const [adminAssistantLoading, setAdminAssistantLoading] = useState(false);
  const [creatingAlertTaskId, setCreatingAlertTaskId] = useState<string | null>(null);
  const [adminAssistantMessages, setAdminAssistantMessages] = useState<AdminAssistantMessage[]>([
    {
      role: "assistant",
      content: "Soy el copiloto IA del organizador. Preguntame que stand potenciar, como generar mas leads o que pabellon revisar primero.",
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [
          { data: fairSummary, error: summaryErr },
          { data: pavilionData, error: pavilionErr },
          { data: standData, error: standErr },
          { data: taskData, error: taskErr },
          { data: leadData, error: leadErr },
          { data: contactData, error: contactErr },
          { data: opportunityData, error: opportunityErr },
          { data: activityData, error: activityErr },
        ] = await Promise.all([
          supabase.from("fair_analytics_summary").select("*").eq("event_id", fairId).maybeSingle(),
          supabase.from("pavilion_analytics_summary").select("*").eq("event_id", fairId).order("visits", { ascending: false }),
          supabase.from("stand_analytics_summary").select("*").eq("event_id", fairId).order("views", { ascending: false }).limit(10),
          supabase
            .from("exhibitor_tasks")
            .select("id,event_id,stand_id,type,status,title,stand_title,detail,suggested_text,created_at,completed_at")
            .eq("event_id", fairId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("stand_leads")
            .select("id,stand_id,action,metadata,created_at")
            .eq("event_id", fairId)
            .order("created_at", { ascending: false })
            .limit(80),
          supabase
            .from("stands")
            .select("id,title,email,phone,whatsapp,website_url")
            .eq("event_id", fairId)
            .order("title", { ascending: true }),
          supabase
            .from("commercial_opportunities")
            .select("id,event_id,stand_id,status,priority,title,stand_title,contact_label,updated_at")
            .eq("event_id", fairId)
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("analytics_events")
            .select("id,user_id,stand_id,pavilion_id,action,metadata,created_at")
            .eq("event_id", fairId)
            .order("created_at", { ascending: false })
            .limit(120),
        ]);

        if (summaryErr) throw summaryErr;
        if (pavilionErr) throw pavilionErr;
        if (standErr) throw standErr;
        if (taskErr) throw taskErr;
        if (leadErr) throw leadErr;
        if (contactErr) throw contactErr;
        if (opportunityErr) throw opportunityErr;
        if (activityErr) throw activityErr;

        setSummary(fairSummary);
        setPavilions(pavilionData || []);
        setStands(standData || []);
        setStandContacts((contactData || []) as StandContact[]);
        setLeads((leadData || []) as StandLead[]);
        const rawActivity = (activityData || []) as Array<ParticipantActivity & { stand_id?: string | null; pavilion_id?: string | null }>;
        const userIds = Array.from(new Set(rawActivity.map((event) => event.user_id).filter(Boolean))) as string[];
        const activityStandIds = Array.from(new Set(rawActivity.map((event) => event.stand_id).filter(Boolean))) as string[];
        const activityPavilionIds = Array.from(new Set(rawActivity.map((event) => event.pavilion_id).filter(Boolean))) as string[];

        const [
          { data: activityProfiles },
          { data: activityStands },
          { data: activityPavilions },
        ] = await Promise.all([
          userIds.length > 0
            ? supabase.from("profiles").select("id,email").in("id", userIds)
            : Promise.resolve({ data: [] }),
          activityStandIds.length > 0
            ? supabase.from("stands").select("id,title").in("id", activityStandIds)
            : Promise.resolve({ data: [] }),
          activityPavilionIds.length > 0
            ? supabase.from("pavilions").select("id,name").in("id", activityPavilionIds)
            : Promise.resolve({ data: [] }),
        ]);

        const emailByUserId = new Map((activityProfiles || []).map((profile) => [profile.id, profile.email]));
        const titleByStandId = new Map((activityStands || []).map((stand) => [stand.id, stand.title]));
        const nameByPavilionId = new Map((activityPavilions || []).map((pavilion) => [pavilion.id, pavilion.name]));

        setActivityEvents(rawActivity.map((event) => ({
          ...event,
          user_email: event.user_id ? emailByUserId.get(event.user_id) || null : null,
          stand_title: event.stand_id ? titleByStandId.get(event.stand_id) || null : null,
          pavilion_name: event.pavilion_id ? nameByPavilionId.get(event.pavilion_id) || null : null,
        })));
        setTasks((taskData || []) as ExhibitorTask[]);
        setOpportunities((opportunityData || []) as CommercialOpportunity[]);

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const insightsResponse = await fetch(`${apiBaseUrl}/events/${fairId}/analytics/insights`);

        if (insightsResponse.ok) {
          const payload = await insightsResponse.json() as { insights?: AnalyticsInsights; mode?: string };
          setInsights(payload.insights || null);
          setInsightsMode(payload.mode || null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las metricas.");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [fairId]);

  const pendingTasks = tasks.filter((task) => task.status === "todo");
  const completedTasks = tasks.filter((task) => task.status === "done");
  const taskCompletion = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const commercialAlerts = buildCommercialAlerts({ leads, tasks, stands, standContacts });
  const criticalAlerts = commercialAlerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = commercialAlerts.filter((alert) => alert.severity === "warning").length;
  const meetings = opportunities.filter((opportunity) => opportunity.status === "meeting_scheduled").length;
  const wonDeals = opportunities.filter((opportunity) => opportunity.status === "won").length;
  const pipelineConversion = opportunities.length > 0 ? Math.round(((meetings + wonDeals) / opportunities.length) * 100) : 0;
  const visibleActivity = activityEvents.filter((event) => activityFilter === "all" || event.action === activityFilter);

  const createTaskFromAlert = async (alert: CommercialAlert) => {
    if (!alert.can_create_task || creatingAlertTaskId) return;

    setCreatingAlertTaskId(alert.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error: insertError } = await supabase
        .from("exhibitor_tasks")
        .insert({
          event_id: fairId,
          stand_id: alert.stand_id || null,
          type: alert.task_type || "improvement",
          status: "todo",
          title: alert.title,
          stand_title: alert.stand_title || null,
          detail: alert.detail,
          suggested_text: alert.suggested_text || alert.detail,
          source: "ai",
          created_by: sessionData.session?.user.id || null,
        })
        .select("id,event_id,stand_id,type,status,title,stand_title,detail,suggested_text,created_at,completed_at")
        .single();

      if (insertError) throw insertError;
      if (data) {
        setTasks((current) => [data as ExhibitorTask, ...current]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear la tarea desde la alerta.");
    } finally {
      setCreatingAlertTaskId(null);
    }
  };

  const askAdminAssistant = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || adminAssistantLoading) return;

    setAdminAssistantMessages((current) => [...current, { role: "user", content: cleanQuestion }]);
    setAdminQuestion("");
    setAdminAssistantLoading(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiBaseUrl}/events/${fairId}/analytics/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          history: adminAssistantMessages.slice(-6),
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar el copiloto de admin.");
      }

      const payload = await response.json() as { answer?: string; mode?: string };
      setAdminAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer || "No tengo respuesta con los datos actuales.",
        },
      ]);
    } catch (err: unknown) {
      setAdminAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "El copiloto no esta disponible ahora mismo.",
        },
      ]);
    } finally {
      setAdminAssistantLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/fairs")} className="p-3 glass rounded-xl text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Analitica de feria</h1>
            <p className="text-white/40">{summary?.event_title || "Resumen de actividad, participantes y leads"}</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
          {error}. Ejecuta primero la migracion SQL de analitica en Supabase.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Metric label="Entradas feria" value={summary?.fair_entries || 0} icon={<Eye size={18} />} />
        <Metric label="Visitantes unicos" value={summary?.unique_visitors || 0} icon={<Users size={18} />} />
        <Metric label="Vistas stands" value={summary?.stand_views || 0} icon={<Store size={18} />} />
        <Metric label="Leads" value={summary?.leads || 0} icon={<MousePointerClick size={18} />} />
      </div>

      <section className="glass rounded-[2rem] p-8 border border-white/5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-black">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Semaforos comerciales</h2>
              <p className="text-sm text-white/40">Alertas automaticas sobre leads, tareas y seguimiento de stands</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-red-200">{criticalAlerts} criticas</span>
            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-orange-200">{warningAlerts} avisos</span>
          </div>
        </div>
        <AlertGrid alerts={commercialAlerts} creatingAlertTaskId={creatingAlertTaskId} onCreateTask={createTaskFromAlert} />
      </section>

      <section className="glass rounded-[2rem] p-8 border border-white/5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-black">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Seguimiento comercial IA</h2>
              <p className="text-sm text-white/40">Tareas que los expositores han guardado desde el copiloto</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/50">
            {taskCompletion}% completado
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Metric label="Tareas pendientes" value={pendingTasks.length} icon={<Clock size={18} />} />
          <Metric label="Tareas completadas" value={completedTasks.length} icon={<CheckCircle2 size={18} />} />
          <Metric label="Total acciones IA" value={tasks.length} icon={<ClipboardList size={18} />} />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <TaskList title="Pendientes prioritarias" tasks={pendingTasks.slice(0, 5)} empty="No hay tareas comerciales pendientes." />
          <TaskList title="Ultimas completadas" tasks={completedTasks.slice(0, 5)} empty="Todavia no hay tareas completadas." />
        </div>
      </section>

      <section className="glass rounded-[2rem] p-8 border border-white/5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-black">
              <Target size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Pipeline comercial</h2>
              <p className="text-sm text-white/40">Estado CRM de oportunidades generadas por los leads</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          <Metric label="Oportunidades" value={opportunities.length} icon={<Target size={18} />} />
          <Metric label="Reuniones" value={meetings} icon={<Clock size={18} />} />
          <Metric label="Ganadas" value={wonDeals} icon={<Trophy size={18} />} />
          <Metric label="Conversion" value={pipelineConversion} suffix="%" icon={<BarChart3 size={18} />} />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <PipelineStatusDistribution opportunities={opportunities} />
          <StalledPipelineList opportunities={opportunities} />
        </div>
      </section>

      {insights && (
        <section className="glass rounded-[2rem] p-8 border border-primary/20 bg-primary/5">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary text-black">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">Analista IA</h2>
                <p className="text-white/40 text-sm">Lectura ejecutiva de actividad, oportunidades y riesgos</p>
              </div>
            </div>
            {insightsMode && (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/50">
                {insightsMode}
              </span>
            )}
          </div>

          <p className="text-lg leading-8 text-white/80 mb-8">{insights.summary}</p>

          <div className="grid lg:grid-cols-3 gap-5">
            <InsightList title="Oportunidades" icon={<Lightbulb size={16} />} items={insights.opportunities} />
            <InsightList title="Riesgos" icon={<ShieldAlert size={16} />} items={insights.risks} />
            <InsightList title="Proximas acciones" icon={<BarChart3 size={16} />} items={insights.next_actions} />
          </div>
        </section>
      )}

      <section className="glass rounded-[2rem] p-8 border border-white/5">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-black">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Copiloto admin</h2>
              <p className="text-sm text-white/40">Pregunta sobre conversion, leads, stands y acciones prioritarias</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {adminAssistantMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-primary text-black"
                      : "border border-white/10 bg-white/[0.06] text-white/75"
                  }`}>
                    {message.content.split("\n").map((line, lineIndex) => (
                      <p key={lineIndex} className={lineIndex > 0 ? "mt-2" : ""}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {adminAssistantLoading && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/60">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Analizando metricas y actividad...
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                askAdminAssistant(adminQuestion);
              }}
              className="mt-5 flex items-center gap-2"
            >
              <input
                value={adminQuestion}
                onChange={(event) => setAdminQuestion(event.target.value)}
                placeholder="Ej: como genero mas leads?"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary"
              />
              <button
                type="submit"
                disabled={adminAssistantLoading || !adminQuestion.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                title="Enviar pregunta"
              >
                <Send size={18} />
              </button>
            </form>
          </div>

          <div className="space-y-3">
            {adminSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => askAdminAssistant(suggestion)}
                disabled={adminAssistantLoading}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-white/55 transition hover:border-primary/50 hover:text-white disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="glass rounded-[2rem] p-8 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Building2 size={18} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">Pabellones mas visitados</h2>
          </div>
          <Ranking rows={pavilions.map((item) => ({ id: item.pavilion_id, name: item.pavilion_name, main: item.visits, sub: `${item.unique_visitors} unicos` }))} empty="Todavia no hay visitas a pabellones." />
        </section>

        <section className="glass rounded-[2rem] p-8 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 size={18} className="text-secondary" />
            <h2 className="text-sm font-black uppercase tracking-widest">Top stands</h2>
          </div>
          <Ranking rows={stands.map((item) => ({ id: item.stand_id, name: item.stand_title, main: item.views, sub: `${item.unique_visitors} unicos - ${item.leads} leads` }))} empty="Todavia no hay visitas a stands." />
        </section>
      </div>

      <section className="glass rounded-[2rem] border border-white/5 p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-3 text-black">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Actividad por participante</h2>
              <p className="text-sm text-white/40">Quien ha entrado, que stand ha visto y en que momento</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activityFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActivityFilter(filter.value)}
                className={`rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition ${
                  activityFilter === filter.value
                    ? "border-primary bg-primary text-black"
                    : "border-white/10 bg-white/[0.04] text-white/45 hover:border-primary/50 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <ParticipantActivityList events={visibleActivity} />
      </section>
    </div>
  );
}

function ParticipantActivityList({ events }: { events: ParticipantActivity[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-sm text-white/35">
        Todavia no hay actividad individual con este filtro.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-4 border-b border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white/35 max-md:hidden">
        <span>Participante</span>
        <span>Actividad</span>
        <span>Destino</span>
        <span>Hora</span>
      </div>
      <div className="divide-y divide-white/10">
        {events.map((event) => (
          <article key={event.id} className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-4 px-5 py-4 max-md:grid-cols-1">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
                <UserRound size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{getActivityUser(event)}</p>
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/25">{event.user_id || "sin id"}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white">{getActivityLabel(event.action)}</p>
              <p className="mt-1 text-xs text-white/35">{getActivityHint(event.action)}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-white/75">{getActivityTarget(event)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary/70">{event.action.replaceAll("_", " ")}</p>
            </div>
            <p className="whitespace-nowrap text-right text-xs font-bold uppercase tracking-widest text-white/35 max-md:text-left">
              {new Date(event.created_at).toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function getActivityUser(event: ParticipantActivity) {
  return event.user_email || "Participante sin email";
}

function getActivityLabel(action: string) {
  const labels: Record<string, string> = {
    fair_entered: "Entro en la feria",
    pavilion_entered: "Entro en pabellon",
    stand_viewed: "Visito un stand",
    auditorium_entered: "Entro al auditorio",
    stand_cta_clicked: "Pulso una llamada a la accion",
    document_opened: "Abrio un documento",
    video_played: "Reprodujo un video",
    chat_message_sent: "Escribio en el chat",
  };

  return labels[action] || action.replaceAll("_", " ");
}

function getActivityHint(action: string) {
  const hints: Record<string, string> = {
    fair_entered: "Acceso general",
    pavilion_entered: "Navegacion",
    stand_viewed: "Interes en expositor",
    auditorium_entered: "Contenido en directo",
    stand_cta_clicked: "Lead potencial",
    document_opened: "Interes en material",
    video_played: "Consumo de contenido",
    chat_message_sent: "Interaccion directa",
  };

  return hints[action] || "Actividad registrada";
}

function getActivityTarget(event: ParticipantActivity) {
  if (event.stand_title) return event.stand_title;
  if (event.pavilion_name) return event.pavilion_name;
  if (event.action === "fair_entered") return "Entrada principal";
  if (event.action === "auditorium_entered") return "Auditorio";

  const metadata = event.metadata || {};
  const metadataTitle = metadata.standTitle || metadata.pavilionName || metadata.title;
  return typeof metadataTitle === "string" ? metadataTitle : "Sin destino asociado";
}

function InsightList({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex items-center gap-2 text-primary">
        {icon}
        <h3 className="text-[10px] font-black uppercase tracking-widest">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <p key={index} className="text-sm leading-6 text-white/65">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function AlertGrid({
  alerts,
  creatingAlertTaskId,
  onCreateTask,
}: {
  alerts: CommercialAlert[];
  creatingAlertTaskId: string | null;
  onCreateTask: (alert: CommercialAlert) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {alerts.map((alert) => {
        const tone = {
          critical: "border-red-500/25 bg-red-500/10 text-red-200",
          warning: "border-orange-500/25 bg-orange-500/10 text-orange-200",
          info: "border-sky-500/25 bg-sky-500/10 text-sky-200",
        }[alert.severity];

        return (
          <article key={alert.id} className={`rounded-2xl border p-5 ${tone}`}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">{alert.title}</h3>
                {alert.stand_title && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/45">{alert.stand_title}</p>}
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[8px] font-black uppercase tracking-widest">
                {alert.severity === "critical" ? "Critico" : alert.severity === "warning" ? "Aviso" : "Info"}
              </span>
            </div>
            <p className="text-sm leading-6 text-white/65">{alert.detail}</p>
            {alert.can_create_task && (
              <button
                onClick={() => onCreateTask(alert)}
                disabled={Boolean(creatingAlertTaskId)}
                className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-black uppercase tracking-widest text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingAlertTaskId === alert.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PlusCircle size={14} />
                )}
                Crear tarea IA
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function TaskList({ title, tasks, empty }: { title: string; tasks: ExhibitorTask[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-primary">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-white/30">{empty}</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white">{task.title}</h4>
                  {task.stand_title && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary">{task.stand_title}</p>}
                </div>
                <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${
                  task.status === "done"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    : "border-orange-500/20 bg-orange-500/10 text-orange-200"
                }`}>
                  {task.status === "done" ? "Hecha" : "Pendiente"}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-white/55">{task.detail}</p>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/25">
                {new Date(task.completed_at || task.created_at).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineStatusDistribution({ opportunities }: { opportunities: CommercialOpportunity[] }) {
  const max = Math.max(...pipelineColumns.map((column) => opportunities.filter((item) => item.status === column.status).length), 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-primary">Distribucion por estado</h3>
      <div className="space-y-4">
        {pipelineColumns.map((column) => {
          const count = opportunities.filter((item) => item.status === column.status).length;
          return (
            <div key={column.status} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">{column.label}</span>
                <span className="text-xs text-white/40">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full bg-primary" style={{ width: count > 0 ? `${Math.max(8, (count / max) * 100)}%` : "0%" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StalledPipelineList({ opportunities }: { opportunities: CommercialOpportunity[] }) {
  const stalled = opportunities
    .filter((item) => item.status === "contact_pending")
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-primary">Atascados en contactar</h3>
      {stalled.length === 0 ? (
        <p className="text-sm text-white/30">No hay oportunidades atascadas en contactar.</p>
      ) : (
        <div className="space-y-3">
          {stalled.map((item) => (
            <article key={item.id} className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white">{item.title}</h4>
                  {item.stand_title && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-orange-200">{item.stand_title}</p>}
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-orange-100">
                  {item.priority}
                </span>
              </div>
              <p className="text-xs leading-5 text-white/55">{item.contact_label || "Visitante registrado"}</p>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/25">
                {new Date(item.updated_at).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon, suffix = "" }: { label: string; value: number; icon: ReactNode; suffix?: string }) {
  return (
    <div className="glass p-6 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-xl bg-white/5 text-primary">{icon}</div>
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black tracking-tight">{value.toLocaleString()}{suffix}</p>
    </div>
  );
}

function Ranking({ rows, empty }: { rows: Array<{ id: string; name: string; main: number; sub: string }>; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-white/30">{empty}</p>;
  }

  const max = Math.max(...rows.map((row) => row.main), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.id} className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-widest truncate">{row.name}</span>
            <span className="text-xs text-white/40 whitespace-nowrap">{row.main.toLocaleString()} visitas</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${Math.max(8, (row.main / max) * 100)}%` }} />
          </div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest">{row.sub}</p>
        </div>
      ))}
    </div>
  );
}
