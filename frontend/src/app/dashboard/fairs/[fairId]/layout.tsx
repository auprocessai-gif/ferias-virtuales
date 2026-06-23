"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import { canManageFair } from "@/lib/dashboardAccess";

export default function FairDashboardLayout({ children }: { children: ReactNode }) {
  const { fairId } = useParams();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        setLoading(true);
        const currentFairId = String(fairId || "");
        const hasAccess = currentFairId ? await canManageFair(currentFairId) : false;

        if (mounted) setAllowed(hasAccess);
      } catch (error) {
        console.warn("[fair-dashboard] access check failed", error);
        if (mounted) setAllowed(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [fairId]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[520px] items-center justify-center px-6">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
            <Lock size={24} />
          </div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary">Acceso a feria</p>
          <h1 className="mb-4 text-2xl font-black uppercase tracking-tight">No tienes permiso para esta feria</h1>
          <p className="mb-6 text-sm leading-6 text-white/55">
            El panel solo se abre para administradores o gestores asignados especificamente a esta feria.
          </p>
          <Link
            href="/dashboard/fairs"
            className="inline-flex rounded-xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-white"
          >
            Volver a mis ferias
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
