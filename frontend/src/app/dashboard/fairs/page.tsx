"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Calendar, 
  ChevronRight, 
  Settings, 
  Globe,
  Layout,
  BarChart3,
  Lock,
  Users,
  Inbox
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Fair {
  id: string;
  title: string;
  slug: string | null;
  status: 'draft' | 'active' | 'archived' | null;
  event_date: string | null;
  description: string | null;
  type: string | null;
  zoom_link: string | null;
  visibility?: 'public' | 'private' | null;
  registration_mode?: 'open' | 'approval_required' | 'invite_only' | null;
}

interface EventAssignment {
  event_id: string;
}

export default function FairsPage() {
  const [fairs, setFairs] = useState<Fair[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setLoading(false); return; }

        // Obtenemos el perfil para saber el rol
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        const userRole = profile?.role || 'participant';
        setRole(userRole);

        // Obtenemos las ferias según el rol
        if (userRole === 'admin') {
          const { data } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });
          setFairs(data || []);
        } else if (userRole === 'manager') {
          const { data: assignments } = await supabase
            .from('event_managers')
            .select('event_id')
            .eq('user_id', session.user.id);
          
          const eventIds = (assignments as EventAssignment[] | null)?.map((assignment) => assignment.event_id) || [];
          if (eventIds.length > 0) {
            const { data } = await supabase
              .from('events')
              .select('*')
              .in('id', eventIds)
              .order('created_at', { ascending: false });
            setFairs(data || []);
          }
        }
      } catch (err) {
        console.error('[FairsPage] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleCreateFair = async () => {
    try {
      const newFairName = prompt("Nombre de la nueva feria:");
      if (!newFairName) return;

      const { data, error } = await supabase.from('events').insert({
        title: newFairName,
        slug: `feria-${Date.now()}`,
        status: 'draft',
        event_date: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      if (data) {
        setFairs([data, ...fairs]);
      }
    } catch (err) {
      console.error('Error creating fair:', err);
      alert('Error creando la feria. Revisa los permisos RLS o la consola.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase mb-2">Gestión de Ferias</h1>
          <p className="text-white/40 font-medium">Visualiza y administra todas tus ferias activas</p>
        </div>
        {role === 'admin' && (
          <button 
            onClick={handleCreateFair}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={16} />
            Nueva Feria
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {fairs.map((fair, index) => (
          <motion.div
            key={fair.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative"
          >
            <div className="glass rounded-[2rem] p-8 border border-white/5 overflow-hidden transition-all hover:border-primary/30 group-hover:shadow-[0_0_40px_rgba(0,242,255,0.1)]">
              <div className="absolute top-6 right-6">
                <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] ${
                  fair.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                  fair.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                  fair.status === 'archived' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                }`}>
                  {fair.status ?? 'activo'}
                </span>
                <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] bg-white/5 text-white/50 border border-white/10 flex items-center gap-1">
                  {fair.visibility === 'private' ? <Lock size={9} /> : <Globe size={9} />}
                  {fair.visibility === 'private' ? 'privada' : 'publica'}
                </span>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center font-black text-2xl text-primary shadow-inner">
                  {fair.title?.charAt(0) ?? '?'}
                </div>

                <div>
                  <h3 className="text-xl font-bold uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{fair.title ?? 'Sin título'}</h3>
                  <div className="flex items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-widest">
                    <Globe size={12} className="text-primary/40" />
                    <span>/{fair.slug ?? 'sin-slug'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                   <div className="flex items-center justify-between text-white/40">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Calendario</span>
                      </div>
                      <span className="text-[10px] font-medium">{fair.event_date ? new Date(fair.event_date).toLocaleDateString() : 'Sin fecha'}</span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Link 
                    href={`/dashboard/fairs/${fair.id}/pavilions`}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    <Layout size={14} className="text-secondary" />
                    Pabellones
                  </Link>
                  <Link
                    href={`/dashboard/fairs/${fair.id}/analytics`}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    <BarChart3 size={14} className="text-primary" />
                    Datos
                  </Link>
                  <Link
                    href={`/dashboard/fairs/${fair.id}/inbox`}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    <Inbox size={14} className="text-primary" />
                    Bandeja
                  </Link>
                  <Link
                    href={`/dashboard/fairs/${fair.id}/participants`}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    <Users size={14} className="text-secondary" />
                    Accesos
                  </Link>
                  <Link 
                    href={`/dashboard/fairs/${fair.id}/settings`}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    <Settings size={14} className="text-primary" />
                    Ajustes
                  </Link>
                </div>
              </div>

              {/* Hover arrow indicator */}
              <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all">
                <ChevronRight className="text-primary" size={24} />
              </div>
            </div>
          </motion.div>
        ))}

        {fairs.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-white/10 rounded-[2.5rem] p-20 flex flex-col items-center justify-center gap-6 text-center bg-white/[0.02]">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <Calendar size={32} className="text-white/20" />
            </div>
            <div>
              <h3 className="text-xl font-bold uppercase tracking-widest mb-2">No tienes ferias asignadas</h3>
              <p className="text-white/30 text-sm max-w-xs">Contacta con el administrador global para que te asigne una feria o te asigne permisos.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
