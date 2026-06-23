"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, CheckCircle2, Mail, Server, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getDashboardAccess, type DashboardAccess } from "@/lib/dashboardAccess";

type FairLink = {
  id: string;
  title: string | null;
  slug: string | null;
};

export default function DashboardSettingsPage() {
  const [access, setAccess] = useState<DashboardAccess | null>(null);
  const [fairs, setFairs] = useState<FairLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const currentAccess = await getDashboardAccess();
        setAccess(currentAccess);

        if (!currentAccess) return;

        if (currentAccess.isAdmin) {
          const { data } = await supabase
            .from("events")
            .select("id,title,slug")
            .order("created_at", { ascending: false });
          setFairs((data || []) as FairLink[]);
          return;
        }

        if (currentAccess.managedFairIds.length > 0) {
          const { data } = await supabase
            .from("events")
            .select("id,title,slug")
            .in("id", currentAccess.managedFairIds)
            .order("created_at", { ascending: false });
          setFairs((data || []) as FairLink[]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const roleLabel = access?.isAdmin
    ? "Administrador global"
    : access?.canOpenDashboard
      ? "Gestor de feria"
      : "Participante";

  return (
    <div className="space-y-10">
      <header>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary">Panel</p>
        <h1 className="text-3xl font-black uppercase tracking-tight">Ajustes</h1>
        <p className="mt-2 text-white/40">Informacion de cuenta, permisos y entorno de trabajo.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-3">
        <InfoCard
          icon={<Mail size={22} />}
          label="Cuenta"
          value={access?.email || "Sin email visible"}
          description="Usuario con sesion activa en la plataforma."
        />
        <InfoCard
          icon={<ShieldCheck size={22} />}
          label="Rol efectivo"
          value={roleLabel}
          description={access?.isAdmin ? "Puede administrar todas las ferias." : "Solo accede a las ferias asignadas."}
        />
        <InfoCard
          icon={<Server size={22} />}
          label="Entorno"
          value="Produccion"
          description="Frontend en Vercel, backend operativo fuera del panel."
        />
      </section>

      <section className="glass overflow-hidden rounded-[2rem] border border-white/5">
        <div className="flex items-center gap-3 border-b border-white/5 p-6">
          <Briefcase size={18} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest">
            {access?.isAdmin ? "Ferias disponibles" : "Mis ferias asignadas"}
          </h2>
        </div>

        {fairs.length === 0 ? (
          <div className="p-10 text-center text-white/35">
            No hay ferias asignadas a esta cuenta.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {fairs.map((fair) => (
              <Link
                key={fair.id}
                href={`/dashboard/fairs/${fair.id}/settings`}
                className="flex items-center justify-between gap-4 p-5 transition hover:bg-white/[0.03]"
              >
                <div>
                  <p className="font-bold">{fair.title || "Feria sin titulo"}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30">/{fair.slug || "sin-slug"}</p>
                </div>
                <span className="rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/55">
                  Ajustes feria
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-white/55">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <CheckCircle2 size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Acceso controlado</span>
        </div>
        Los participantes normales no ven el panel. Los gestores acceden solo a las ferias asignadas por admin.
      </section>
    </div>
  );
}

function InfoCard({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
  return (
    <div className="glass rounded-[2rem] border border-white/5 p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/35">{label}</p>
      <h2 className="mt-2 break-words text-xl font-black tracking-tight">{value}</h2>
      <p className="mt-3 text-sm leading-6 text-white/40">{description}</p>
    </div>
  );
}
