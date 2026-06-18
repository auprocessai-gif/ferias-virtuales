"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, Settings, Video, Box, Briefcase, Inbox } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

const dashboardRoles = new Set(["admin", "manager", "exhibitor", "speaker"]);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          window.location.href = `/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`;
          return;
        }

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          const profileRole = profile?.role || "participant";

          if (!dashboardRoles.has(profileRole)) {
            window.location.href = "/";
            return;
          }

          setRole(profileRole);
        }
      } catch (err) {
        console.error("DashboardLayout Auth Error:", err);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-black/40 border-r border-white/5 backdrop-blur-3xl flex flex-col">
        <div className="p-8 border-b border-white/5 text-center">
            <h1 className="text-xl font-black tracking-tighter bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent uppercase">
                {role === 'admin' ? 'Super Admin' : role === 'manager' ? 'Panel Gestor' : 'Panel Expositor'}
            </h1>
        </div>

        <nav className="flex-1 px-4 py-8 flex flex-col gap-2">
          {/* Common Links */}
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 text-primary transition-colors border border-primary/20 shadow-[0_0_15px_rgba(0,242,255,0.1)]">
            <LayoutDashboard size={18} />
            <span className="text-xs uppercase font-bold tracking-widest">Resumen</span>
          </Link>

          <Link href="/dashboard/inbox" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
            <Inbox size={18} className="group-hover:text-primary transition-colors"/>
            <span className="text-xs uppercase font-bold tracking-widest">Bandeja</span>
          </Link>

          {/* Manager / Admin Specific Links */}
          {(role === 'admin' || role === 'manager') && (
            <>
              <Link href="/dashboard/fairs" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
                <Briefcase size={18} className="group-hover:text-primary transition-colors"/>
                <span className="text-xs uppercase font-bold tracking-widest">Mis Ferias</span>
              </Link>
            </>
          )}

          {/* Exhibitor Specific Links (MI STAND) */}
          {role === 'exhibitor' && (
            <>
              <Link href="/dashboard/appearance" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
                <Box size={18} className="group-hover:text-primary transition-colors"/>
                <span className="text-xs uppercase font-bold tracking-widest">Apariencia</span>
              </Link>
              <Link href="/dashboard/content" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
                <Video size={18} className="group-hover:text-primary transition-colors"/>
                <span className="text-xs uppercase font-bold tracking-widest">Contenido</span>
              </Link>
            </>
          )}

          <div className="mt-auto pt-4 border-t border-white/5">
             <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
                <Settings size={18} className="group-hover:text-primary transition-colors"/>
                <span className="text-xs uppercase font-bold tracking-widest">Ajustes</span>
              </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={16} />
            <span className="text-xs uppercase font-bold tracking-widest">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto">
        {/* Background glow for content */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 p-12 w-full max-w-6xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
