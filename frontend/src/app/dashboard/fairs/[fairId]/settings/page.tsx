"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Globe, EyeOff, Eye, Lock, UserCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function FairSettingsPage() {
  const { fairId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fair, setFair] = useState({
    title: "",
    slug: "",
    status: "draft",
    visibility: "public",
    registration_mode: "open",
  });

  useEffect(() => {
    async function loadFair() {
      try {
        const { data } = await supabase.from("events").select("*").eq("id", fairId).single();
        if (data) {
          setFair({
            title: data.title || "",
            slug: data.slug || "",
            status: data.status || "draft",
            visibility: data.visibility || "public",
            registration_mode: data.registration_mode || "open",
          });
        }
      } catch (err) {
        console.error("Error loading fair settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFair();
  }, [fairId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          title: fair.title,
          slug: fair.slug,
          status: fair.status,
          visibility: fair.visibility,
          registration_mode: fair.registration_mode,
        })
        .eq("id", fairId);

      if (error) throw error;
      alert("Ajustes guardados correctamente");
      router.push("/dashboard/fairs");
    } catch (err: unknown) {
      alert(`Error al guardar: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Cargando ajustes...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/fairs")} className="p-3 glass rounded-xl text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Ajustes de la Feria</h1>
            <p className="text-white/40">Modifica el acceso y configuracion global de tu evento</p>
          </div>
        </div>
      </header>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-12 rounded-[2rem] border border-white/5 space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-4">Nombre Oficial del Evento</label>
          <input
            type="text"
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:border-primary focus:outline-none transition-colors"
            value={fair.title}
            onChange={(e) => setFair({ ...fair, title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-4">URL Personalizada (Slug)</label>
          <div className="flex items-center gap-2 w-full bg-black/40 border border-white/10 rounded-2xl px-4 focus-within:border-primary transition-colors">
            <Globe size={16} className="text-white/30" />
            <span className="text-white/30 text-sm py-4">misitio.com/expo/</span>
            <input
              type="text"
              className="flex-1 bg-transparent border-none text-white focus:outline-none text-sm"
              value={fair.slug}
              onChange={(e) => setFair({ ...fair, slug: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-4">Estado de publicacion</label>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setFair({ ...fair, status: "draft" })}
              className={`p-6 rounded-2xl flex items-center justify-between transition-all border ${fair.status === "draft" ? "border-yellow-500 bg-yellow-500/10" : "border-white/5 bg-black/20 hover:border-white/20"}`}
            >
              <div className="text-left">
                <h4 className="font-bold text-sm text-yellow-500 mb-1">BORRADOR</h4>
                <p className="text-xs text-white/40">Feria invisible mientras configuras pabellones y stands.</p>
              </div>
              <EyeOff className={fair.status === "draft" ? "text-yellow-500" : "text-white/20"} />
            </button>

            <button
              onClick={() => setFair({ ...fair, status: "active" })}
              className={`p-6 rounded-2xl flex items-center justify-between transition-all border ${fair.status === "active" ? "border-green-500 bg-green-500/10" : "border-white/5 bg-black/20 hover:border-white/20"}`}
            >
              <div className="text-left">
                <h4 className="font-bold text-sm text-green-500 mb-1">PUBLICADA</h4>
                <p className="text-xs text-white/40">La feria ya puede recibir participantes desde su enlace.</p>
              </div>
              <Eye className={fair.status === "active" ? "text-green-500" : "text-white/20"} />
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-4">Acceso de participantes</label>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setFair({ ...fair, visibility: "public", registration_mode: "open" })}
              className={`p-6 rounded-2xl flex items-center justify-between transition-all border ${fair.visibility === "public" && fair.registration_mode === "open" ? "border-green-500 bg-green-500/10" : "border-white/5 bg-black/20 hover:border-white/20"}`}
            >
              <div className="text-left">
                <h4 className="font-bold text-sm text-green-500 mb-1">PUBLICA ABIERTA</h4>
                <p className="text-xs text-white/40">El participante se registra desde el enlace y entra automaticamente.</p>
              </div>
              <Globe className={fair.visibility === "public" ? "text-green-500" : "text-white/20"} />
            </button>

            <button
              onClick={() => setFair({ ...fair, visibility: "private", registration_mode: "approval_required" })}
              className={`p-6 rounded-2xl flex items-center justify-between transition-all border ${fair.visibility === "private" && fair.registration_mode === "approval_required" ? "border-yellow-500 bg-yellow-500/10" : "border-white/5 bg-black/20 hover:border-white/20"}`}
            >
              <div className="text-left">
                <h4 className="font-bold text-sm text-yellow-500 mb-1">CON APROBACION</h4>
                <p className="text-xs text-white/40">El usuario solicita acceso y queda pendiente hasta que el gestor lo apruebe.</p>
              </div>
              <UserCheck className={fair.registration_mode === "approval_required" ? "text-yellow-500" : "text-white/20"} />
            </button>

            <button
              onClick={() => setFair({ ...fair, visibility: "private", registration_mode: "invite_only" })}
              className={`col-span-2 p-6 rounded-2xl flex items-center justify-between transition-all border ${fair.visibility === "private" && fair.registration_mode === "invite_only" ? "border-red-500 bg-red-500/10" : "border-white/5 bg-black/20 hover:border-white/20"}`}
            >
              <div className="text-left">
                <h4 className="font-bold text-sm text-red-400 mb-1">SOLO INVITACION</h4>
                <p className="text-xs text-white/40">Reservado para ferias privadas con lista de invitados o enlace/token.</p>
              </div>
              <Lock className={fair.registration_mode === "invite_only" ? "text-red-400" : "text-white/20"} />
            </button>
          </div>
        </div>

        <div className="pt-8">
          <button
            disabled={saving}
            onClick={handleSave}
            className="w-full flex justify-center items-center gap-3 bg-gradient-to-r from-primary to-secondary py-4 rounded-2xl text-black font-black uppercase tracking-[0.2em] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Guardando..." : <><Save size={20} /> Guardar Cambios</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
