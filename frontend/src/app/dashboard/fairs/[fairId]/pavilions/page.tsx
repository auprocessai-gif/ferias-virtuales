"use client";

import { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  ArrowLeft, 
  Layout, 
  Store, 
  Trash2, 
  Edit2,
  ChevronRight,
  Globe,
  Image as ImageIcon
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Pavilion {
  id: string;
  name: string;
  background_url: string;
  created_at: string;
}

export default function PavilionsPage({ params }: { params: Promise<{ fairId: string }> }) {
  const { fairId } = use(params);
  const router = useRouter();
  const [pavilions, setPavilions] = useState<Pavilion[]>([]);
  const [fairName, setFairName] = useState("");
  const [fairSlug, setFairSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPavilionName, setNewPavilionName] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Ejecutamos ambas peticiones en PARALELO para máxima velocidad
        const [fairRes, pavilionsRes] = await Promise.all([
          supabase.from('events').select('name, slug').eq('id', fairId).single(),
          supabase.from('pavilions').select('*').eq('event_id', fairId).order('created_at', { ascending: true })
        ]);

        if (fairRes.data) {
          setFairName(fairRes.data.name || "");
          setFairSlug(fairRes.data.slug || "");
        }

        if (pavilionsRes.data) {
          setPavilions(pavilionsRes.data);
        }
      } catch (err) {
        console.error("Error fetching pavilions data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [fairId]);

  const handleCreatePavilion = async () => {
    if (!newPavilionName) return;
    
    try {
      const { data, error } = await supabase.from('pavilions').insert({
        event_id: fairId,
        name: newPavilionName,
        background_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200'
      }).select().single();

      if (error) throw error;

      if (data) {
        setPavilions([...pavilions, data]);
        setNewPavilionName("");
        setShowAddModal(false);
      }
    } catch (err: any) {
      console.error('Error al crear pabellón:', err);
      alert(`Error creando Pabellón. Posible bloqueo de RLS: ${err.message}`);
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
        <div className="flex flex-col gap-4">
          <Link href="/dashboard/fairs" className="flex items-center gap-2 text-white/40 hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Volver a Ferias
          </Link>
          <div>
            <h1 className="text-4xl font-black tracking-tight uppercase mb-2">Pabellones</h1>
            <p className="text-white/40 font-medium">Gestionar espacios en <span className="text-primary/60">{fairName}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {fairSlug && (
            <Link 
              href={`/expo/${fairSlug}`}
              target="_blank"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/10 transition-all flex items-center gap-2"
            >
              <Globe size={14} />
              Ver Feria en Vivo
            </Link>
          )}
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-secondary/20"
          >
            <Plus size={16} />
            Añadir Pabellón
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {pavilions.map((pavilion, index) => (
          <motion.div
            key={pavilion.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group"
          >
            <div className="glass rounded-3xl p-6 border border-white/5 flex items-center gap-8 hover:border-secondary/30 transition-all hover:bg-white/[0.03]">
               <div className="w-24 h-24 rounded-2xl bg-black/40 border border-white/5 overflow-hidden flex-shrink-0 relative">
                  <img src={pavilion.background_url} alt={pavilion.name} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Layout size={24} className="text-white/20" />
                  </div>
               </div>

               <div className="flex-1">
                  <h3 className="text-xl font-bold uppercase tracking-widest mb-2 group-hover:text-secondary transition-colors">{pavilion.name}</h3>
                  <div className="flex items-center gap-6">
                     <div className="flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-widest">
                        <Store size={14} className="text-primary/50" />
                        <span>Gestión de Stands</span>
                     </div>
                     <div className="flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-widest">
                        <ImageIcon size={14} className="text-secondary/50" />
                        <span>Fondo 2.5D configurado</span>
                     </div>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <Link 
                    href={`/dashboard/fairs/${fairId}/pavilions/${pavilion.id}/stands`}
                    className="flex items-center gap-3 px-8 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-white transition-all border border-white/5 group-hover:shadow-[0_0_20px_rgba(112,0,255,0.2)]"
                  >
                    Configurar Stands
                    <ChevronRight size={16} />
                  </Link>
                  <button className="p-4 rounded-2xl bg-red-500/10 text-red-500/40 hover:text-red-500 hover:bg-red-500/20 transition-all border border-red-500/5">
                    <Trash2 size={18} />
                  </button>
               </div>
            </div>
          </motion.div>
        ))}

        {pavilions.length === 0 && (
          <div className="border-2 border-dashed border-white/10 rounded-[2.5rem] p-20 flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <Layout size={32} className="text-white/20" />
            </div>
            <div>
              <h3 className="text-xl font-bold uppercase tracking-widest mb-2">No hay pabellones aún</h3>
              <p className="text-white/30 text-sm">Crea el primer pabellón para empezar a añadir stands.</p>
            </div>
            <button 
               onClick={() => setShowAddModal(true)}
               className="mt-4 px-8 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
            >
               Crear Pabellón
            </button>
          </div>
        )}
      </div>

      {/* Basic Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pb-24">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setShowAddModal(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass rounded-[2.5rem] p-10 border border-white/10 shadow-2xl"
            >
               <h3 className="text-2xl font-black uppercase tracking-tighter mb-8">Nuevo Pabellón</h3>
               <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Nombre del Pabellón</label>
                    <input 
                      type="text" 
                      value={newPavilionName}
                      onChange={(e) => setNewPavilionName(e.target.value)}
                      placeholder="Ej: Pabellón de Universidades"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-secondary/50 focus:ring-1 focus:ring-secondary/20 transition-all font-bold"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-8 py-4 rounded-2xl border border-white/5 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all text-white/60"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleCreatePavilion}
                      className="flex-1 px-8 py-4 bg-secondary rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-secondary/20"
                    >
                      Crear Espacio
                    </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
