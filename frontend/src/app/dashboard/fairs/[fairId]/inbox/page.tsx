"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BellRing, Bot, CheckCircle2, ClipboardList, Columns3, Copy, Loader2, MessageCircle, MousePointerClick, Save, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StandLead {
  id: string;
  event_id: string;
  stand_id: string;
  user_id: string | null;
  action: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  stands?: {
    title?: string | null;
  } | null;
  profiles?: {
    email?: string | null;
  } | null;
}

interface StandMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  room: string;
  created_at: string;
}

interface StandItem {
  id: string;
  title: string | null;
}

type ExhibitorAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type ExhibitorAction = {
  type: "reply" | "faq" | "improvement";
  title: string;
  stand_title?: string | null;
  detail: string;
  suggested_text?: string;
};

type CommercialTask = ExhibitorAction & {
  id: string;
  event_id?: string;
  stand_id?: string | null;
  status: "todo" | "done";
  created_at: string;
  completed_at?: string | null;
};

type CommercialTaskRow = {
  id: string;
  event_id: string;
  stand_id: string | null;
  type: "reply" | "faq" | "improvement";
  status: "todo" | "done";
  title: string;
  stand_title: string | null;
  detail: string;
  suggested_text: string | null;
  created_at: string;
  completed_at: string | null;
};

type TaskStorageMode = "supabase" | "local";
type OpportunityStatus = "new" | "contact_pending" | "contacted" | "interested" | "meeting_scheduled" | "won" | "lost";
type OpportunityPriority = "low" | "medium" | "high";

type CommercialOpportunity = {
  id: string;
  event_id: string;
  stand_id: string;
  lead_id: string | null;
  status: OpportunityStatus;
  priority: OpportunityPriority;
  title: string;
  stand_title: string | null;
  contact_label: string | null;
  next_step: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const opportunityColumns: Array<{ status: OpportunityStatus; label: string }> = [
  { status: "new", label: "Nuevos" },
  { status: "contact_pending", label: "Contactar" },
  { status: "contacted", label: "Contactados" },
  { status: "interested", label: "Interesados" },
  { status: "meeting_scheduled", label: "Reunion" },
  { status: "won", label: "Ganado" },
  { status: "lost", label: "Perdido" },
];

const exhibitorSuggestions = [
  "Que debo responder primero?",
  "Como convierto mas leads?",
  "Como va el pipeline?",
  "Que oportunidad es prioritaria?",
];

function mapTaskRow(row: CommercialTaskRow): CommercialTask {
  return {
    id: row.id,
    event_id: row.event_id,
    stand_id: row.stand_id,
    type: row.type,
    status: row.status,
    title: row.title,
    stand_title: row.stand_title,
    detail: row.detail,
    suggested_text: row.suggested_text || undefined,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

function classifyLeadOpportunity(lead: StandLead) {
  const normalizedAction = lead.action.toLowerCase();
  const metadataText = Object.values(lead.metadata || {})
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const hasDirectContact = ["attention_requested", "whatsapp_clicked", "phone_clicked", "email_clicked"].includes(normalizedAction);
  const hasMeetingIntent = metadataText.includes("demo") || metadataText.includes("reunion") || metadataText.includes("llamada") || metadataText.includes("presupuesto");
  const hasResearchIntent = normalizedAction.includes("document") || normalizedAction.includes("pdf") || normalizedAction.includes("website");

  if (hasMeetingIntent) {
    return {
      status: "interested" as OpportunityStatus,
      priority: "high" as OpportunityPriority,
      title: "Interes comercial detectado",
      next_step: "Contactar hoy y proponer reunion o demo concreta.",
    };
  }

  if (hasDirectContact) {
    return {
      status: "contact_pending" as OpportunityStatus,
      priority: "high" as OpportunityPriority,
      title: normalizedAction === "attention_requested" ? "Solicitud de atencion" : getLeadLabel(lead.action),
      next_step: "Responder hoy y cerrar siguiente paso.",
    };
  }

  if (hasResearchIntent) {
    return {
      status: "new" as OpportunityStatus,
      priority: "medium" as OpportunityPriority,
      title: getLeadLabel(lead.action),
      next_step: "Enviar informacion relacionada y preguntar si quiere ampliar detalles.",
    };
  }

  return {
    status: "new" as OpportunityStatus,
    priority: "low" as OpportunityPriority,
    title: getLeadLabel(lead.action),
    next_step: "Revisar interes y contactar si procede.",
  };
}

function readLocalTasks(fairKey: string): CommercialTask[] {
  if (typeof window === "undefined") return [];
  const rawTasks = window.localStorage.getItem(`exhibitor-commercial-plan:${fairKey}`);
  if (!rawTasks) return [];

  try {
    return JSON.parse(rawTasks) as CommercialTask[];
  } catch {
    return [];
  }
}

async function migrateLocalTasksToSupabase(fairKey: string, localTasks: CommercialTask[]): Promise<CommercialTask[] | null> {
  if (localTasks.length === 0) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const rows = localTasks.map((task) => ({
    event_id: fairKey,
    type: task.type,
    status: task.status,
    title: task.title,
    stand_title: task.stand_title || null,
    detail: task.detail,
    suggested_text: task.suggested_text || null,
    source: "ai",
    created_by: sessionData.session?.user.id || null,
    completed_by: task.status === "done" ? sessionData.session?.user.id || null : null,
    created_at: task.created_at,
    completed_at: task.completed_at || null,
  }));

  const { data, error } = await supabase
    .from("exhibitor_tasks")
    .insert(rows)
    .select("id,event_id,stand_id,type,status,title,stand_title,detail,suggested_text,created_at,completed_at");

  if (!error && data && typeof window !== "undefined") {
    window.localStorage.removeItem(`exhibitor-commercial-plan:${fairKey}`);
    return (data as CommercialTaskRow[]).map(mapTaskRow);
  }

  return null;
}

export default function FairInboxPage() {
  const { fairId } = useParams();
  const router = useRouter();
  const fairKey = String(fairId || "fair");
  const [loading, setLoading] = useState(true);
  const [fairTitle, setFairTitle] = useState("Feria");
  const [leads, setLeads] = useState<StandLead[]>([]);
  const [messages, setMessages] = useState<StandMessage[]>([]);
  const [stands, setStands] = useState<StandItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "attention" | "contacts" | "messages">("all");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantActions, setAssistantActions] = useState<ExhibitorAction[]>([]);
  const [commercialTasks, setCommercialTasks] = useState<CommercialTask[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [pipelineAvailable, setPipelineAvailable] = useState(true);
  const [updatingOpportunityId, setUpdatingOpportunityId] = useState<string | null>(null);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [taskStorageMode, setTaskStorageMode] = useState<TaskStorageMode>("supabase");
  const [assistantMessages, setAssistantMessages] = useState<ExhibitorAssistantMessage[]>([
    {
      role: "assistant",
      content: "Soy el copiloto del expositor. Puedo priorizar respuestas, resumir leads y decirte que mejorar para convertir mas visitas en contactos.",
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCommercialTasks() {
      setTasksLoaded(false);

      const localTasks = readLocalTasks(fairKey);

      try {
        const { data, error: tasksError } = await supabase
          .from("exhibitor_tasks")
          .select("id,event_id,stand_id,type,status,title,stand_title,detail,suggested_text,created_at,completed_at")
          .eq("event_id", fairKey)
          .order("created_at", { ascending: false });

        if (tasksError) throw tasksError;

        if ((data || []).length === 0 && localTasks.length > 0) {
          const migratedTasks = await migrateLocalTasksToSupabase(fairKey, localTasks);
          if (migratedTasks) {
            setTaskStorageMode("supabase");
            setCommercialTasks(migratedTasks);
            return;
          }
        }

        setTaskStorageMode("supabase");
        setCommercialTasks(((data || []) as CommercialTaskRow[]).map(mapTaskRow));
      } catch {
        setTaskStorageMode("local");
        setCommercialTasks(localTasks);
      } finally {
        setTasksLoaded(true);
      }
    }

    loadCommercialTasks();
  }, [fairKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!tasksLoaded) return;
    if (taskStorageMode !== "local") return;
    window.localStorage.setItem(`exhibitor-commercial-plan:${fairKey}`, JSON.stringify(commercialTasks));
  }, [commercialTasks, fairKey, taskStorageMode, tasksLoaded]);

  const loadOpportunities = async (leadRows: StandLead[]) => {
    try {
      const { data, error: opportunitiesError } = await supabase
        .from("commercial_opportunities")
        .select("id,event_id,stand_id,lead_id,status,priority,title,stand_title,contact_label,next_step,notes,created_at,updated_at")
        .eq("event_id", fairKey)
        .order("updated_at", { ascending: false });

      if (opportunitiesError) throw opportunitiesError;

      const existingRows = (data || []) as CommercialOpportunity[];
      const existingLeadIds = new Set(existingRows.map((item) => item.lead_id).filter(Boolean));
      const missingLeads = leadRows.filter((lead) => !existingLeadIds.has(lead.id));

      if (missingLeads.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const rows = missingLeads.map((lead) => {
          const standTitle = lead.stands?.title || getStringMetadata(lead.metadata, "stand_title") || "Stand sin titulo";
          const classification = classifyLeadOpportunity(lead);
          return {
            event_id: fairKey,
            stand_id: lead.stand_id,
            lead_id: lead.id,
            status: classification.status,
            priority: classification.priority,
            title: classification.title,
            stand_title: standTitle,
            contact_label: lead.profiles?.email || "Visitante registrado",
            next_step: classification.next_step,
            notes: getLeadDetail(lead),
            created_by: sessionData.session?.user.id || null,
          };
        });

        const { data: insertedRows, error: insertError } = await supabase
          .from("commercial_opportunities")
          .insert(rows)
          .select("id,event_id,stand_id,lead_id,status,priority,title,stand_title,contact_label,next_step,notes,created_at,updated_at");

        if (!insertError && insertedRows) {
          setOpportunities([...(insertedRows as CommercialOpportunity[]), ...existingRows]);
        } else {
          setOpportunities(existingRows);
        }
      } else {
        setOpportunities(existingRows);
      }

      setPipelineAvailable(true);
    } catch {
      setPipelineAvailable(false);
      setOpportunities([]);
    }
  };

  useEffect(() => {
    async function loadInbox() {
      try {
        setLoading(true);
        setError(null);

        const [{ data: event }, { data: standRows, error: standsError }, { data: leadRows, error: leadsError }] = await Promise.all([
          supabase.from("events").select("title").eq("id", fairId).maybeSingle(),
          supabase.from("stands").select("id,title").eq("event_id", fairId).order("title", { ascending: true }),
          supabase
            .from("stand_leads")
            .select("id,event_id,stand_id,user_id,action,notes,metadata,created_at,stands(title),profiles(email)")
            .eq("event_id", fairId)
            .order("created_at", { ascending: false })
            .limit(80),
        ]);

        if (standsError) throw standsError;
        if (leadsError) throw leadsError;

        const nextStands = (standRows || []) as StandItem[];
        const rooms = nextStands.map((stand) => `stand:${stand.id}`);

        let messageRows: StandMessage[] = [];
        if (rooms.length > 0) {
          const { data, error: messagesError } = await supabase
            .from("messages")
            .select("id,user_id,user_name,content,room,created_at")
            .in("room", rooms)
            .order("created_at", { ascending: false })
            .limit(80);

          if (messagesError) throw messagesError;
          messageRows = (data || []) as StandMessage[];
        }

        setFairTitle(event?.title || "Feria");
        setStands(nextStands);
        const nextLeads = (leadRows || []) as StandLead[];
        setLeads(nextLeads);
        setMessages(messageRows);
        await loadOpportunities(nextLeads);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la bandeja.");
      } finally {
        setLoading(false);
      }
    }

    loadInbox();
  }, [fairId]);

  const standTitleByRoom = useMemo(() => {
    return new Map(stands.map((stand) => [`stand:${stand.id}`, stand.title || "Stand sin titulo"]));
  }, [stands]);

  const attentionRequests = leads.filter((lead) => lead.action === "attention_requested");
  const contactLeads = leads.filter((lead) => lead.action !== "attention_requested");
  const totalItems = leads.length + messages.length;

  const visibleLeads = activeFilter === "attention"
    ? attentionRequests
    : activeFilter === "contacts"
      ? contactLeads
      : activeFilter === "messages"
        ? []
        : leads;

  const visibleMessages = activeFilter === "messages" || activeFilter === "all" ? messages : [];
  const pendingTasks = commercialTasks.filter((task) => task.status === "todo").length;
  const completedTasks = commercialTasks.filter((task) => task.status === "done").length;

  const saveActionAsTask = async (action: ExhibitorAction) => {
    const signature = `${action.type}-${action.title}-${action.stand_title || ""}-${action.detail}`;
    const alreadySaved = commercialTasks.some((task) => `${task.type}-${task.title}-${task.stand_title || ""}-${task.detail}` === signature);
    if (alreadySaved) return;

    const draftTask: CommercialTask = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      event_id: fairKey,
      status: "todo",
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    if (taskStorageMode === "supabase") {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error: insertError } = await supabase
        .from("exhibitor_tasks")
        .insert({
          event_id: fairKey,
          type: action.type,
          status: "todo",
          title: action.title,
          stand_title: action.stand_title || null,
          detail: action.detail,
          suggested_text: action.suggested_text || null,
          source: "ai",
          created_by: sessionData.session?.user.id || null,
        })
        .select("id,event_id,stand_id,type,status,title,stand_title,detail,suggested_text,created_at,completed_at")
        .single();

      if (!insertError && data) {
        setCommercialTasks((current) => [mapTaskRow(data as CommercialTaskRow), ...current]);
        return;
      }

      setTaskStorageMode("local");
    }

    setCommercialTasks((current) => [draftTask, ...current]);
  };

  const toggleTaskStatus = async (taskId: string) => {
    const currentTask = commercialTasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const nextStatus = currentTask.status === "todo" ? "done" : "todo";
    const completedAt = nextStatus === "done" ? new Date().toISOString() : null;

    setCommercialTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, status: nextStatus, completed_at: completedAt } : task
    )));

    if (taskStorageMode === "supabase") {
      const { data: sessionData } = await supabase.auth.getSession();
      const { error: updateError } = await supabase
        .from("exhibitor_tasks")
        .update({
          status: nextStatus,
          completed_at: completedAt,
          completed_by: nextStatus === "done" ? sessionData.session?.user.id || null : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (updateError) {
        setTaskStorageMode("local");
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    setCommercialTasks((current) => current.filter((task) => task.id !== taskId));

    if (taskStorageMode === "supabase") {
      const { error: deleteError } = await supabase
        .from("exhibitor_tasks")
        .delete()
        .eq("id", taskId);

      if (deleteError) {
        setTaskStorageMode("local");
      }
    }
  };

  const updateOpportunityStatus = async (opportunityId: string, status: OpportunityStatus) => {
    const closedAt = status === "won" || status === "lost" ? new Date().toISOString() : null;
    setUpdatingOpportunityId(opportunityId);
    setOpportunities((current) => current.map((opportunity) => (
      opportunity.id === opportunityId
        ? { ...opportunity, status, updated_at: new Date().toISOString() }
        : opportunity
    )));

    try {
      const { error: updateError } = await supabase
        .from("commercial_opportunities")
        .update({
          status,
          closed_at: closedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opportunityId);

      if (updateError) throw updateError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la oportunidad.");
    } finally {
      setUpdatingOpportunityId(null);
    }
  };

  const askExhibitorAssistant = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || assistantLoading) return;

    setAssistantMessages((current) => [...current, { role: "user", content: cleanQuestion }]);
    setAssistantQuestion("");
    setAssistantLoading(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiBaseUrl}/events/${fairId}/exhibitor/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          history: assistantMessages.slice(-6),
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar el copiloto del expositor.");
      }

      const payload = await response.json() as { answer?: string; actions?: ExhibitorAction[]; mode?: string };
      setAssistantActions(payload.actions || []);
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer || "No tengo respuesta con la actividad actual.",
        },
      ]);
    } catch (err) {
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "El copiloto no esta disponible ahora mismo.",
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/fairs")} className="glass rounded-xl p-3 text-white/50 transition-colors hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Bandeja del expositor</h1>
            <p className="text-white/40">{fairTitle}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-right">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary">Actividad</p>
          <p className="text-2xl font-black">{totalItems}</p>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Metric icon={<BellRing size={18} />} label="Atencion solicitada" value={attentionRequests.length} />
        <Metric icon={<MousePointerClick size={18} />} label="Leads contacto" value={contactLeads.length} />
        <Metric icon={<MessageCircle size={18} />} label="Mensajes stand" value={messages.length} />
        <Metric icon={<ClipboardList size={18} />} label="Tareas pendientes" value={pendingTasks} />
      </div>

      <CommercialTaskBoard
        tasks={commercialTasks}
        completedTasks={completedTasks}
        storageMode={taskStorageMode}
        onToggle={toggleTaskStatus}
        onDelete={deleteTask}
      />

      <PipelineBoard
        opportunities={opportunities}
        available={pipelineAvailable}
        updatingOpportunityId={updatingOpportunityId}
        onChangeStatus={updateOpportunityStatus}
      />

      <section className="glass rounded-[2rem] border border-primary/20 bg-primary/5 p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-primary p-3 text-black">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Copiloto expositor</h2>
            <p className="text-sm text-white/40">Prioriza leads, resume mensajes y recomienda acciones comerciales</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {assistantMessages.map((message, index) => (
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
              {assistantLoading && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/60">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Analizando leads y mensajes...
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                askExhibitorAssistant(assistantQuestion);
              }}
              className="mt-5 flex items-center gap-2"
            >
              <input
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                placeholder="Ej: que debo responder primero?"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary"
              />
              <button
                type="submit"
                disabled={assistantLoading || !assistantQuestion.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                title="Enviar pregunta"
              >
                <Send size={18} />
              </button>
            </form>
          </div>

          <div className="space-y-3">
            {exhibitorSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => askExhibitorAssistant(suggestion)}
                disabled={assistantLoading}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-white/55 transition hover:border-primary/50 hover:text-white disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}

            {assistantActions.length > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-black/25 p-4">
                <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                  <ClipboardList size={14} />
                  Acciones IA
                </div>
                <div className="space-y-3">
                  {assistantActions.map((action, index) => (
                    <AssistantActionCard
                      key={`${action.type}-${index}`}
                      action={action}
                      onUse={() => askExhibitorAssistant(action.suggested_text || action.detail)}
                      onSave={() => saveActionAsTask(action)}
                      saved={commercialTasks.some((task) => task.title === action.title && task.detail === action.detail)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <FilterButton active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>Todo</FilterButton>
        <FilterButton active={activeFilter === "attention"} onClick={() => setActiveFilter("attention")}>Solicitudes</FilterButton>
        <FilterButton active={activeFilter === "contacts"} onClick={() => setActiveFilter("contacts")}>Leads</FilterButton>
        <FilterButton active={activeFilter === "messages"} onClick={() => setActiveFilter("messages")}>Mensajes</FilterButton>
      </div>

      <section className="grid gap-5">
        {visibleLeads.map((lead) => (
          <InboxItem
            key={lead.id}
            icon={lead.action === "attention_requested" ? <BellRing size={18} /> : <MousePointerClick size={18} />}
            tone={lead.action === "attention_requested" ? "orange" : "green"}
            title={lead.action === "attention_requested" ? "Solicitan atencion" : getLeadLabel(lead.action)}
            subtitle={lead.stands?.title || getStringMetadata(lead.metadata, "stand_title") || "Stand sin titulo"}
            detail={getLeadDetail(lead)}
            person={lead.profiles?.email || "Visitante registrado"}
            date={lead.created_at}
          />
        ))}

        {visibleMessages.map((message) => (
          <InboxItem
            key={message.id}
            icon={<MessageCircle size={18} />}
            tone="blue"
            title="Mensaje en chat del stand"
            subtitle={standTitleByRoom.get(message.room) || "Stand"}
            detail={message.content}
            person={message.user_name}
            date={message.created_at}
          />
        ))}

        {visibleLeads.length === 0 && visibleMessages.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/25">
              <BellRing size={28} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest">Sin actividad todavia</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/35">
              Cuando un visitante solicite atencion, escriba en el chat del stand o pulse una llamada a la accion, aparecera aqui.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function CommercialTaskBoard({
  tasks,
  completedTasks,
  storageMode,
  onToggle,
  onDelete,
}: {
  tasks: CommercialTask[];
  completedTasks: number;
  storageMode: TaskStorageMode;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/5 p-3 text-primary">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Plan comercial IA</h2>
            <p className="text-sm text-white/40">Guarda acciones del copiloto para convertirlas en tareas del expositor.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-3 text-black">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Plan comercial IA</h2>
            <p className="text-sm text-white/40">{tasks.length - completedTasks} pendientes, {completedTasks} completadas</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${
          storageMode === "supabase"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            : "border-orange-500/20 bg-orange-500/10 text-orange-200"
        }`}>
          {storageMode === "supabase" ? "Supabase" : "Local"}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {tasks.map((task) => (
          <CommercialTaskCard key={task.id} task={task} onToggle={() => onToggle(task.id)} onDelete={() => onDelete(task.id)} />
        ))}
      </div>
    </section>
  );
}

function PipelineBoard({
  opportunities,
  available,
  updatingOpportunityId,
  onChangeStatus,
}: {
  opportunities: CommercialOpportunity[];
  available: boolean;
  updatingOpportunityId: string | null;
  onChangeStatus: (opportunityId: string, status: OpportunityStatus) => void;
}) {
  if (!available) {
    return (
      <section className="rounded-[2rem] border border-dashed border-orange-500/20 bg-orange-500/10 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/15 p-3 text-orange-200">
            <Columns3 size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Pipeline comercial</h2>
            <p className="text-sm text-orange-100/60">Ejecuta la migracion SQL de oportunidades para activar el CRM de leads.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-primary p-3 text-black">
          <Columns3 size={20} />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">Pipeline comercial</h2>
          <p className="text-sm text-white/40">Leads convertidos en oportunidades comerciales por estado</p>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/35">
          Aun no hay oportunidades. Se crearan automaticamente cuando entren leads del stand.
        </div>
      ) : (
        <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-7">
          {opportunityColumns.map((column) => {
            const columnItems = opportunities.filter((opportunity) => opportunity.status === column.status);
            return (
              <div key={column.status} className="min-w-[220px] rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70">{column.label}</h3>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-black text-white/40">{columnItems.length}</span>
                </div>
                <div className="space-y-3">
                  {columnItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/25">Sin leads</div>
                  ) : (
                    columnItems.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        busy={updatingOpportunityId === opportunity.id}
                        onChangeStatus={(status) => onChangeStatus(opportunity.id, status)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OpportunityCard({
  opportunity,
  busy,
  onChangeStatus,
}: {
  opportunity: CommercialOpportunity;
  busy: boolean;
  onChangeStatus: (status: OpportunityStatus) => void;
}) {
  const priorityClass = {
    high: "border-red-500/20 bg-red-500/10 text-red-200",
    medium: "border-orange-500/20 bg-orange-500/10 text-orange-200",
    low: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  }[opportunity.priority];

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white">{opportunity.title}</h4>
          {opportunity.stand_title && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary">{opportunity.stand_title}</p>}
        </div>
        <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${priorityClass}`}>
          {opportunity.priority}
        </span>
      </div>
      <p className="text-xs leading-5 text-white/55">{opportunity.contact_label || "Visitante registrado"}</p>
      {opportunity.next_step && <p className="mt-2 text-xs leading-5 text-white/45">{opportunity.next_step}</p>}
      <select
        value={opportunity.status}
        disabled={busy}
        onChange={(event) => onChangeStatus(event.target.value as OpportunityStatus)}
        className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:border-primary disabled:opacity-50"
      >
        {opportunityColumns.map((column) => (
          <option key={column.status} value={column.status}>{column.label}</option>
        ))}
      </select>
    </article>
  );
}

function CommercialTaskCard({ task, onToggle, onDelete }: { task: CommercialTask; onToggle: () => void; onDelete: () => void }) {
  const copyText = async () => {
    await navigator.clipboard.writeText(task.suggested_text || task.detail);
  };

  return (
    <article className={`rounded-2xl border p-4 transition ${task.status === "done" ? "border-emerald-500/20 bg-emerald-500/10" : "border-white/10 bg-black/20"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${task.status === "done" ? "text-emerald-200" : "text-white"}`}>{task.title}</h3>
          {task.stand_title && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary">{task.stand_title}</p>}
        </div>
        <button
          onClick={onToggle}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
            task.status === "done" ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200" : "border-white/10 bg-white/5 text-white/40 hover:text-white"
          }`}
          title={task.status === "done" ? "Marcar pendiente" : "Marcar hecha"}
        >
          <CheckCircle2 size={17} />
        </button>
      </div>
      <p className="text-xs leading-5 text-white/60">{task.detail}</p>
      {task.suggested_text && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/65">
          {task.suggested_text}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={copyText}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:text-white"
          title="Copiar texto"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 transition hover:bg-red-500/20"
          title="Eliminar tarea"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function AssistantActionCard({ action, onUse, onSave, saved }: { action: ExhibitorAction; onUse: () => void; onSave: () => void; saved: boolean }) {
  const tone = {
    reply: "text-orange-300 border-orange-500/20 bg-orange-500/10",
    faq: "text-sky-300 border-sky-500/20 bg-sky-500/10",
    improvement: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
  }[action.type];

  const copyText = async () => {
    if (!action.suggested_text) return;
    await navigator.clipboard.writeText(action.suggested_text);
  };

  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white">{action.title}</h3>
          {action.stand_title && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/40">{action.stand_title}</p>}
        </div>
        <Sparkles size={15} className="shrink-0" />
      </div>
      <p className="text-xs leading-5 text-white/60">{action.detail}</p>
      {action.suggested_text && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/65">
          {action.suggested_text}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onUse}
          className="flex h-9 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-[9px] font-black uppercase tracking-widest text-black transition hover:bg-white"
        >
          Usar
        </button>
        <button
          onClick={onSave}
          disabled={saved}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={saved ? "Tarea guardada" : "Guardar como tarea"}
        >
          <Save size={14} />
        </button>
        {action.suggested_text && (
          <button
            onClick={copyText}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:text-white"
            title="Copiar texto"
          >
            <Copy size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-2xl border border-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl bg-white/5 p-3 text-primary">{icon}</div>
      </div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition ${
        active ? "bg-primary text-black" : "border border-white/10 bg-white/5 text-white/45 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function InboxItem({
  icon,
  tone,
  title,
  subtitle,
  detail,
  person,
  date,
}: {
  icon: ReactNode;
  tone: "orange" | "green" | "blue";
  title: string;
  subtitle: string;
  detail: string;
  person: string;
  date: string;
}) {
  const toneClass = {
    orange: "bg-orange-500/15 text-orange-300 border-orange-500/20",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  }[tone];

  return (
    <article className="glass rounded-[2rem] border border-white/5 p-6">
      <div className="flex gap-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-primary">{subtitle}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              {new Date(date).toLocaleString()}
            </span>
          </div>
          <p className="text-sm leading-6 text-white/65">{detail}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
            <UserRound size={13} />
            {person}
          </div>
        </div>
      </div>
    </article>
  );
}

function getLeadLabel(action: string) {
  const labels: Record<string, string> = {
    whatsapp_clicked: "WhatsApp pulsado",
    email_clicked: "Email pulsado",
    phone_clicked: "Telefono pulsado",
    website_clicked: "Web visitada",
  };

  return labels[action] || action.replaceAll("_", " ");
}

function getLeadDetail(lead: StandLead) {
  if (lead.action === "attention_requested") {
    return "El visitante ha pedido hablar con alguien del stand. Conviene responder por el chat del stand o contactar por los datos disponibles.";
  }

  const value = getStringMetadata(lead.metadata, "value") || getStringMetadata(lead.metadata, "url");
  return value ? `Interaccion registrada: ${value}` : "Interaccion registrada en el stand.";
}

function getStringMetadata(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}
