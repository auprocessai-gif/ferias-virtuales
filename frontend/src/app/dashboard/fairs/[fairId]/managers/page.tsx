"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, RefreshCcw, Search, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getDashboardAccess } from "@/lib/dashboardAccess";

type ManagerAssignment = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
};

type Profile = {
  id: string;
  email: string | null;
  role: string | null;
};

type Fair = {
  title?: string | null;
  name?: string | null;
};

export default function FairManagersPage() {
  const { fairId } = useParams();
  const router = useRouter();
  const [fair, setFair] = useState<Fair | null>(null);
  const [assignments, setAssignments] = useState<ManagerAssignment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentFairId = String(fairId || "");

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const loadManagers = useCallback(async () => {
    setLoading(true);

    try {
      const access = await getDashboardAccess();
      const admin = Boolean(access?.isAdmin);
      setIsAdmin(admin);

      if (!admin) {
        setLoading(false);
        return;
      }

      const [fairResult, assignmentsResult] = await Promise.all([
        supabase.from("events").select("*").eq("id", currentFairId).maybeSingle(),
        supabase
          .from("event_managers")
          .select("id,event_id,user_id,created_at")
          .eq("event_id", currentFairId)
          .order("created_at", { ascending: false }),
      ]);

      if (fairResult.error) throw fairResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      const loadedAssignments = (assignmentsResult.data || []) as ManagerAssignment[];
      setFair((fairResult.data || null) as Fair | null);
      setAssignments(loadedAssignments);

      const userIds = loadedAssignments.map((assignment) => assignment.user_id);
      if (userIds.length === 0) {
        setProfiles({});
        return;
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,email,role")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      setProfiles(Object.fromEntries(((profileRows || []) as Profile[]).map((profile) => [profile.id, profile])));
    } catch (error) {
      console.error("[FairManagersPage] Error loading managers:", error);
      showNotice("No se pudieron cargar los gestores.");
    } finally {
      setLoading(false);
    }
  }, [currentFairId, showNotice]);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  const managerRows = useMemo(() => assignments.map((assignment) => ({
    ...assignment,
    profile: profiles[assignment.user_id],
  })), [assignments, profiles]);

  const assignManager = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setSaving(true);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,role")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.id) {
        showNotice("Ese email aun no tiene cuenta. Primero debe registrarse en la plataforma.");
        return;
      }

      const { error } = await supabase
        .from("event_managers")
        .upsert(
          { event_id: currentFairId, user_id: profile.id },
          { onConflict: "event_id,user_id" }
        );

      if (error) throw error;

      setEmail("");
      showNotice("Gestor asignado a esta feria.");
      await loadManagers();
    } catch (error) {
      console.error("[FairManagersPage] Error assigning manager:", error);
      showNotice(error instanceof Error ? error.message : "No se pudo asignar el gestor.");
    } finally {
      setSaving(false);
    }
  };

  const removeManager = async (assignmentId: string) => {
    if (!window.confirm("Quieres quitar a este gestor de la feria?")) return;

    const { error } = await supabase
      .from("event_managers")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      showNotice(`No se pudo quitar el acceso: ${error.message}`);
      return;
    }

    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    showNotice("Acceso de gestor retirado.");
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <ShieldCheck className="mx-auto mb-5 text-primary" size={34} />
        <h1 className="mb-3 text-2xl font-black uppercase tracking-tight">Solo admin</h1>
        <p className="mb-6 text-sm leading-6 text-white/55">
          Los gestores pueden trabajar su feria, pero no pueden nombrar ni quitar otros gestores.
        </p>
        <button
          onClick={() => router.push("/dashboard/fairs")}
          className="rounded-xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white"
        >
          Volver a mis ferias
        </button>
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

      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/fairs")} className="p-3 glass rounded-xl text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary">Acceso admin</p>
            <h1 className="text-3xl font-black uppercase tracking-tight">Gestores de feria</h1>
            <p className="text-white/40">{fair?.title || fair?.name || "Feria"} - solo el admin puede conceder este acceso</p>
          </div>
        </div>
        <button
          onClick={loadManagers}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 transition hover:border-primary/50 hover:text-white"
        >
          <RefreshCcw size={14} />
          Actualizar
        </button>
      </header>

      <section className="glass rounded-[2rem] border border-white/5 p-6">
        <form onSubmit={assignManager} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="gestor@empresa.com"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-4 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none transition focus:border-primary/60"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white disabled:opacity-50"
          >
            <Search size={14} />
            {saving ? "Asignando" : "Asignar gestor"}
          </button>
        </form>
        <p className="mt-4 text-xs leading-6 text-white/40">
          El usuario debe existir en la plataforma. Al asignarlo aqui podra abrir el panel, pero solo para esta feria.
        </p>
      </section>

      <section className="glass overflow-hidden rounded-[2rem] border border-white/5">
        <div className="flex items-center gap-3 border-b border-white/5 p-6">
          <UserCog size={18} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest">Gestores asignados</h2>
        </div>

        {managerRows.length === 0 ? (
          <div className="p-12 text-center text-white/30">Todavia no hay gestores asignados a esta feria.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {managerRows.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-bold">{assignment.profile?.email || assignment.user_id}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">
                    Asignado {new Date(assignment.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => removeManager(assignment.id)}
                  className="rounded-xl bg-red-500/10 p-3 text-red-400 transition hover:bg-red-500 hover:text-white"
                  title="Quitar gestor"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
