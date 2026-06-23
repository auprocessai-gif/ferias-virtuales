"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { AlertCircle, LogOut, ShieldCheck, User as UserIcon, X } from "lucide-react";
import { usePresence } from "@/context/PresenceProvider";
import { useFairStore, type UserRole } from "@/store/useFairStore";
import { usePathname } from "next/navigation";
import { getSessionWithTimeout, withTimeout } from "@/lib/supabaseAuth";
import { getDashboardAccess } from "@/lib/dashboardAccess";

const normalizeUserRole = (role?: string | null): UserRole => (
  role === 'admin' || role === 'manager' ? role : 'participant'
);

type NavNotice = {
  eyebrow: string;
  title: string;
  body: string;
};

export default function Navbar() {
  const pathname = usePathname();
  const { onlineUsers, isNexusConnected } = usePresence();
  const [user, setUser] = useState<User | null>(null);
  const { reset, setView, setUserRole, userRole } = useFairStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [participantFairSlug, setParticipantFairSlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<NavNotice | null>(null);

  useEffect(() => {
    let mounted = true;
    let authRefreshTimer: number | undefined;

    const loadUserAccess = async (sessionUser?: User | null) => {
      if (!mounted) return;
      const currentUser = sessionUser ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setUserRole(null);
        setParticipantFairSlug(null);
        return;
      }

      try {
        const dashboardAccess = await getDashboardAccess();

        if (!mounted) return;
        const role = dashboardAccess?.canOpenDashboard && dashboardAccess.role !== "admin"
          ? "manager"
          : normalizeUserRole(dashboardAccess?.role);
        setUserRole(role);

        if (role !== 'participant') {
          setParticipantFairSlug(null);
          return;
        }

        const { data: participantAccess } = await withTimeout(
          supabase
            .from("event_participants")
            .select("event_id")
            .eq("user_id", currentUser.id)
            .in("status", ["registered", "approved"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          "No se pudo comprobar la feria asignada."
        );

        if (!mounted) return;
        if (!participantAccess?.event_id) {
          setParticipantFairSlug(null);
          return;
        }

        const { data: event } = await withTimeout(
          supabase
            .from("events")
            .select("slug")
            .eq("id", participantAccess.event_id)
            .maybeSingle(),
          "No se pudo cargar la feria asignada."
        );

        if (mounted) setParticipantFairSlug(event?.slug || null);
      } catch (error) {
        console.warn("[navbar] user access check failed", error);
        if (mounted) {
          setUserRole(currentUser ? "participant" : null);
          setParticipantFairSlug(null);
        }
      }
    };

    const checkUser = async () => {
      const { data: { session } } = await getSessionWithTimeout("Navbar session check");
      const currentUser = session?.user ?? null;
      await loadUserAccess(currentUser);
    };

    checkUser().catch((error) => {
      console.warn("[navbar] session check failed", error);
      if (mounted) {
        setUser(null);
        setUserRole(null);
        setParticipantFairSlug(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (authRefreshTimer) window.clearTimeout(authRefreshTimer);
      authRefreshTimer = window.setTimeout(() => {
        loadUserAccess(session?.user ?? null);
      }, 0);
    });

    return () => {
      mounted = false;
      if (authRefreshTimer) window.clearTimeout(authRefreshTimer);
      subscription.unsubscribe();
    };
  }, [setUserRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setParticipantFairSlug(null);
    setNotice(null);
    window.location.href = "/";
  };

  const handlePabellonRedirect = (e: React.MouseEvent) => {
    if (userRole === 'participant' && !participantFairSlug && !window.location.pathname.startsWith('/expo/')) {
      e.preventDefault();
      setNotice({
        eyebrow: "Acceso de participante",
        title: "Feria no asignada",
        body: "Esta cuenta aun no tiene una feria asociada. Abre el enlace exacto de tu feria o pide al organizador que active tu acceso.",
      });
      return;
    }

    setNotice(null);

    // Si estamos en una ruta de feria /expo/[slug], evitamos la recarga completa
    if (window.location.pathname.startsWith('/expo/')) {
      e.preventDefault();
      reset();
      setView('pavilion');
    } else if (window.location.pathname === '/') {
      setIsRefreshing(true);
      reset();
      setTimeout(() => setIsRefreshing(false), 800);
    } else {
      reset();
    }
  };

  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/login")) {
    return null;
  }

  const canOpenPanel = userRole === 'admin' || userRole === 'manager';
  const pavilionHref = userRole === 'participant' && participantFairSlug
    ? `/expo/${participantFairSlug}`
    : "/";

  return (
    <>
    <header className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl h-16 rounded-2xl border border-white/20 bg-orange-600 backdrop-blur-3xl flex items-center px-8 justify-between shadow-[0_20px_50px_rgba(255,81,0,0.3)]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg">
          <div className="w-4 h-4 bg-orange-600 rounded-sm" />
        </div>
        <Link href="/" onClick={handlePabellonRedirect} className="text-lg font-black tracking-tighter uppercase text-white hover:opacity-80 transition-opacity flex items-center gap-2">
          FERIA <span className="text-white opacity-80">VIRTUAL</span>
          {isRefreshing && <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
        </Link>
      </div>
      
      <nav className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-white">
        <Link 
          href={pavilionHref} 
          onClick={handlePabellonRedirect}
          className="hover:opacity-60 transition-all hover:tracking-[0.4em] relative flex items-center gap-2 group"
        >
          Pabellon
          <div className="flex items-center gap-1.5 ml-1">
            {isNexusConnected ? (
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            )}
            {onlineUsers.length > 0 && (
              <span className="text-[10px] font-black text-white tracking-normal">
                {onlineUsers.length}
              </span>
            )}
          </div>
          {isRefreshing && (
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-white/40 animate-pulse" />
          )}
        </Link>
        <button 
          onClick={() => setView('auditorium')}
          className="hover:opacity-60 transition-all hover:tracking-[0.4em] uppercase"
        >
          Auditorio
        </button>
        <button 
          onClick={() => {
            setNotice({
              eyebrow: "Networking",
              title: "Muy pronto",
              body: "Estamos preparando esta zona para conectar participantes, gestores y stands dentro de cada feria.",
            });
          }}
          className="hover:opacity-60 transition-all hover:tracking-[0.4em]"
        >
          Networking
        </button>
      </nav>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20">
              {canOpenPanel ? (
                <ShieldCheck size={14} className="text-white animate-pulse" />
              ) : (
                <UserIcon size={14} className="text-white/60" />
              )}
              <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[150px]">
                {user.email?.split('@')[0]}
              </span>
              {userRole && (
                <span className="text-[8px] bg-white text-orange-600 px-1.5 py-0.5 rounded border border-white/20 font-bold">
                  {userRole}
                </span>
              )}
            </div>
            {canOpenPanel && (
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-xl bg-white text-orange-600 text-[10px] font-black hover:bg-orange-50 transition-all uppercase tracking-widest shadow-lg"
              >
                Mi Panel
              </Link>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all"
              title="Cerrar sesion"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <>
            <Link 
              href="/login" 
              className="px-5 py-2 rounded-xl bg-white text-orange-600 text-[10px] font-black hover:bg-orange-50 transition-all uppercase tracking-widest shadow-lg"
            >
              Acceso
            </Link>
          </>
        )}
      </div>
    </header>

    {notice && (
      <div className="fixed top-24 left-1/2 z-[70] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-orange-400/30 bg-[#15100f]/95 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600/20 text-orange-500 ring-1 ring-orange-500/30">
            <AlertCircle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.32em] text-orange-500">
                  {notice.eyebrow}
                </p>
                <h2 className="mt-1 text-xl font-black uppercase tracking-wide">
                  {notice.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:border-white/25 hover:text-white"
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {notice.body}
            </p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-orange-600 transition hover:bg-orange-50"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
