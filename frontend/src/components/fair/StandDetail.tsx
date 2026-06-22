"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Stand } from "@/../../shared";
import { 
  X, 
  Play, 
  FileText, 
  Info, 
  Globe, 
  Phone, 
  Link as LinkIcon,
  Mail,
  ArrowLeft,
  Bot,
  MessageCircle
} from "lucide-react";
import { usePresence } from "@/context/PresenceProvider";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import StandAssistant from "./StandAssistant";
import StandSocialPanel from "./StandSocialPanel";
import { useFairStore } from "@/store/useFairStore";
import { getStandTheme } from "./standTheme";

const getExternalLink = (url: string | null) => {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
};

const getEmbedUrl = (url: string | null) => {
  if (!url) return null;
  let embedUrl = url;
  
  // YouTube conversion logic
  if (url.includes('youtube.com/watch?v=')) {
    embedUrl = url.replace('watch?v=', 'embed/');
  } else if (url.includes('youtu.be/')) {
    const id = url.split('/').pop();
    embedUrl = `https://www.youtube.com/embed/${id}`;
  }
  
  // Append autoplay if needed or other params
  return embedUrl;
};

interface StandDetailProps {
  stand: Stand;
  eventId?: string | null;
  onClose: () => void;
}

export default function StandDetail({ stand, eventId, onClose }: StandDetailProps) {
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [syncingDocs, setSyncingDocs] = useState(false);
  const [documentSyncMessage, setDocumentSyncMessage] = useState<string | null>(null);
  const socialRef = useRef<HTMLDivElement | null>(null);
  const assistantRef = useRef<HTMLDivElement | null>(null);
  const viewedStandRef = useRef<string | null>(null);
  const { updateStatus } = usePresence();
  const { userRole } = useFairStore();
  const canManageStandDocuments = userRole === "admin" || userRole === "manager";
  const standTheme = getStandTheme(stand);

  useEffect(() => {
    updateStatus('viewing', stand.id);
    return () => updateStatus('active');
  }, [stand.id, updateStatus]);

  useEffect(() => {
    if (viewedStandRef.current === stand.id) return;
    viewedStandRef.current = stand.id;
    const analyticsEventId = stand.event_id ?? eventId;
    if (!analyticsEventId) return;

    trackAnalyticsEvent({
      eventId: analyticsEventId,
      pavilionId: stand.pavilion_id ?? null,
      standId: stand.id,
      action: "stand_viewed",
      metadata: {
        title: stand.title,
        source: "stand_detail",
      },
    });
  }, [eventId, stand.event_id, stand.id, stand.pavilion_id, stand.title]);

  const recordStandAction = async (action: string, metadata: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const analyticsEventId = stand.event_id ?? eventId;

    trackAnalyticsEvent({
      eventId: analyticsEventId,
      pavilionId: stand.pavilion_id ?? null,
      standId: stand.id,
      action: action === "document_opened" ? "document_opened" : "stand_cta_clicked",
      metadata,
    });

    if (!session?.user) return;

    const leadActions = ["whatsapp_clicked", "email_clicked", "phone_clicked", "website_clicked"];
    if (!leadActions.includes(action)) return;
    if (!analyticsEventId) return;

    const { error } = await supabase.from("stand_leads").insert({
      event_id: analyticsEventId,
      stand_id: stand.id,
      user_id: session.user.id,
      action,
      metadata,
    });

    if (error) {
      console.warn("[lead] not recorded", error.message);
    }
  };

  const syncDocumentsForAi = async () => {
    setSyncingDocs(true);
    setDocumentSyncMessage(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiBaseUrl}/stands/${stand.id}/documents/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("No se pudieron sincronizar los PDFs.");
      }

      const data = await response.json() as { synced?: number };
      setDocumentSyncMessage(
        data.synced && data.synced > 0
          ? `${data.synced} documento(s) listos para la IA.`
          : "No se pudo extraer texto de los documentos."
      );
      recordStandAction("document_ai_synced", { synced: data.synced || 0 });
    } catch (error) {
      setDocumentSyncMessage(error instanceof Error ? error.message : "Error sincronizando documentos.");
    } finally {
      setSyncingDocs(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 overflow-hidden backdrop-blur-xl"
      style={{
        background: `linear-gradient(135deg, ${standTheme.hex} 0%, ${standTheme.dark} 44%, #111716 100%)`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, rgba(255,255,255,0.16), rgba(${standTheme.rgb},0.16) 38%, rgba(0,0,0,0.22))`,
        }}
      />
      
      {/* Container Principal */}
      <div className="relative w-full max-w-7xl h-full max-h-[900px] flex flex-col md:flex-row overflow-hidden rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
        
        {/* ESCENA DEL STAND (FONDO GENERADO) */}
        <div className="relative flex-[2.5] bg-black overflow-hidden flex flex-col">
           {/* La Imagen de Fondo Profesional */}
           <img 
              src="/images/stand_bg_premium.png" 
              className="absolute inset-0 w-full h-full object-cover"
              alt="Stand Background"
           />
           
           {/* El "Monitor" central (donde va el vídeo) */}
           <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[65%] aspect-video z-10">
              {/* Marco del monitor con brillo naranja suave */}
              <div
                className="absolute -inset-4 border border-white/5 rounded-3xl bg-white/5 backdrop-blur-lg"
                style={{ boxShadow: `0 0 100px rgba(${standTheme.rgb}, 0.24)` }}
              />
              
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-black shadow-inner">
                 {stand.video_url ? (
                   <iframe 
                     src={getEmbedUrl(stand.video_url) || ''} 
                     className="w-full h-full" 
                     frameBorder="0" 
                     allow="autoplay; encrypted-media" 
                     allowFullScreen
                   />
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20">
                     <Play size={48} />
                     <span className="text-[10px] uppercase tracking-widest font-black">Vídeo no configurado</span>
                   </div>
                 )}
              </div>
           </div>

            {/* Logo Integrado en la MARQUESINA (Diseño SUPER XL Limpio) */}
            <div className="absolute top-24 md:top-[11%] left-1/2 -translate-x-1/2 w-[56%] md:w-[42%] h-[12%] z-20 flex items-center justify-center pointer-events-none">
               <div className="relative w-full h-full flex items-center justify-center p-2">
                  {stand.logo_url ? (
                    <img src={stand.logo_url} alt="Marquee Logo" className="max-w-full max-h-full object-contain brightness-125 contrast-125 select-none drop-shadow-[0_0_40px_rgba(255,255,255,0.7)]" />
                  ) : (
                    <span className="text-[14px] font-black text-white/30 uppercase tracking-[1.2em] select-none">TU MARCA AQUÍ</span>
                  )}
               </div>
            </div>

            {/* Cabecera con Botón de Atrás y Cerrar */}
            <div className="absolute top-5 left-5 right-5 md:top-6 md:left-8 md:right-8 flex justify-between items-start gap-4 z-30">
               <button 
                  onClick={onClose}
                  className="group flex shrink-0 items-center gap-2 md:gap-3 px-4 md:px-5 py-3 rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-white transition-all border border-white/10 shadow-xl"
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = standTheme.hex;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.4)";
                  }}
               >
                  <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="hidden sm:inline text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">Volver al Pabellón</span>
               </button>

               <div className="flex max-w-[66%] flex-wrap items-center justify-end gap-2 md:gap-3">
                 <button
                    onClick={() => socialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="group flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 rounded-full transition-all border border-white/20 shadow-xl"
                    style={{ backgroundColor: "#ffffff", color: standTheme.hex }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = "#0f172a";
                      event.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = "#ffffff";
                      event.currentTarget.style.color = standTheme.hex;
                    }}
                 >
                    <MessageCircle size={18} />
                    <span className="hidden sm:inline text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">Chat stand</span>
                 </button>

                 <button
                    onClick={() => assistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="group flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 rounded-full transition-all border border-white/20 shadow-xl"
                    style={{ backgroundColor: standTheme.hex, color: "#ffffff" }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = "#ffffff";
                      event.currentTarget.style.color = standTheme.hex;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = standTheme.hex;
                      event.currentTarget.style.color = "#ffffff";
                    }}
                 >
                    <Bot size={18} />
                    <span className="hidden sm:inline text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">Preguntar IA</span>
                 </button>

                 <button 
                    onClick={onClose}
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white hover:bg-red-500/20 transition-all border border-white/10 shadow-xl"
                 >
                    <X size={20} />
                 </button>
               </div>
            </div>

           {/* Galería Inferior (Tiras de imágenes) */}
           <div className="absolute bottom-10 left-10 right-10 z-20">
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                 {stand.images?.map((img, i) => (
                   <motion.div 
                     key={i}
                     whileHover={{ scale: 1.05, y: -5 }}
                     onClick={() => setActivePhoto(img)}
                     className="flex-shrink-0 w-32 h-20 rounded-xl overflow-hidden glass border border-white/20 cursor-pointer"
                   >
                      <img src={img} className="w-full h-full object-cover" />
                   </motion.div>
                 ))}
                 {!stand.images?.length && (
                    <div className="text-[9px] uppercase tracking-widest text-white/20 font-black italic">No hay fotos en la galería</div>
                 )}
              </div>
           </div>
        </div>

        {/* PANEL LATERAL DE INFORMACIÓN (MODO BLANCO PREMIUM) */}
        <aside className="relative flex-1 bg-white/90 border-l border-slate-200 backdrop-blur-3xl overflow-y-auto p-10 flex flex-col gap-10 shadow-[-10px_0_50px_rgba(0,0,0,0.2)]">
           <div ref={socialRef} className="scroll-mt-6">
             <StandSocialPanel stand={stand} />
           </div>

           <div ref={assistantRef} className="scroll-mt-6">
             <StandAssistant
               stand={stand}
               onQuestion={(question, mode) => {
                 recordStandAction("ai_stand_question", {
                   question,
                   assistant_mode: mode || "unknown",
                 });
               }}
             />
           </div>

           <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                 <Info size={14} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Sobre Nosotros</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 font-medium">
                 {stand.description || 'Esta empresa no ha proporcionado una descripción todavía.'}
              </p>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 text-amber-600">
                 <div className="flex items-center gap-2">
                   <FileText size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Descargables</span>
                 </div>
                 {canManageStandDocuments && (stand.pdf_url || stand.pdf_url_2) && (
                   <button
                     onClick={syncDocumentsForAi}
                     disabled={syncingDocs}
                     className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-50"
                   >
                     {syncingDocs ? "Sincronizando" : "Sincronizar IA"}
                   </button>
                 )}
              </div>
              {documentSyncMessage && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                  {documentSyncMessage}
                </div>
              )}
              <div className="space-y-3">
                 {[
                   { url: stand.pdf_url, label: 'Catálogo Principal' },
                   { url: stand.pdf_url_2, label: 'Documentación Extra' }
                 ].filter(p => p.url).map((pdf, i) => (
                   <button 
                     key={i}
                     onClick={() => {
                       recordStandAction("document_opened", { label: pdf.label, url: pdf.url });
                       window.open(getExternalLink(pdf.url || null), '_blank');
                     }}
                     className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-amber-500 hover:bg-white transition-all group shadow-sm"
                   >
                      <span className="text-xs font-bold text-slate-600 group-hover:text-amber-700 uppercase tracking-tight">{pdf.label}</span>
                      <Play size={12} className="text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                   </button>
                 ))}
              </div>
           </div>

           {/* CONTACTO Y REDES */}
           <div className="mt-auto pt-10 border-t border-slate-100 space-y-8">
              <div className="grid grid-cols-1 gap-4">
                 {stand.whatsapp && (
                   <button 
                     onClick={() => {
                       recordStandAction("whatsapp_clicked", { value: stand.whatsapp });
                       window.open(`https://wa.me/${(stand.whatsapp || '').replace(/[^0-9]/g, '')}`, '_blank');
                     }}
                     className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3"
                   >
                      <Play size={14} /> Contactar WhatsApp
                   </button>
                 )}
                 
                 <div className="grid grid-cols-1 gap-3">
                    {stand.phone && (
                      <a
                        href={`tel:${stand.phone}`}
                        onClick={() => recordStandAction("phone_clicked", { value: stand.phone })}
                        className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:bg-white transition-all group shadow-sm"
                      >
                         <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600"><Phone size={14}/></div>
                         <div className="flex flex-col">
                            <span className="text-[8px] uppercase tracking-widest font-black opacity-40 text-slate-500">Teléfono</span>
                            <span className="text-xs font-bold text-slate-800">{stand.phone}</span>
                         </div>
                      </a>
                    )}
                    {stand.email && (
                      <a
                        href={`mailto:${stand.email}`}
                        onClick={() => recordStandAction("email_clicked", { value: stand.email })}
                        className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:bg-white transition-all group shadow-sm"
                      >
                         <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600"><Mail size={14}/></div>
                         <div className="flex flex-col">
                            <span className="text-[8px] uppercase tracking-widest font-black opacity-40 text-slate-500">Email</span>
                            <span className="text-xs font-bold text-slate-800">{stand.email}</span>
                         </div>
                      </a>
                    )}
                 </div>
              </div>

                <div className="flex items-center justify-center gap-4">
                   {[
                     { icon: Globe, url: stand.website_url, color: 'text-blue-600 bg-blue-50 hover:bg-blue-600' },
                     { icon: LinkIcon, url: stand.linkedin, color: 'text-[#0077b5] bg-blue-50 hover:bg-[#0077b5]' },
                     { icon: LinkIcon, url: stand.instagram, color: 'text-[#E1306C] bg-pink-50 hover:bg-[#E1306C]' },
                     { icon: LinkIcon, url: stand.facebook, color: 'text-[#1877F2] bg-blue-50 hover:bg-[#1877F2]' }
                   ].filter(s => s.url).map((social, i) => (
                     <button 
                       key={i}
                       onClick={() => {
                         recordStandAction(i === 0 ? "website_clicked" : "social_clicked", { url: social.url });
                         window.open(getExternalLink(social.url || null), '_blank');
                       }}
                       className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:text-white shadow-sm border border-slate-100 ${social.color}`}
                     >
                        <social.icon size={20} />
                     </button>
                   ))}
                </div>
           </div>
        </aside>
      </div>

      {/* Visor de Foto Fullscreen */}
      <AnimatePresence>
        {activePhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-10"
            onClick={() => setActivePhoto(null)}
          >
             <button className="absolute top-10 right-10 text-white/40 hover:text-white"><X size={40}/></button>
             <img src={activePhoto} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-primary/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
