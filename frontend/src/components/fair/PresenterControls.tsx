"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Monitor, 
  Camera, 
  FileText, 
  Play, 
  Mic, 
  MicOff, 
  Settings, 
  X, 
  Share2, 
  Globe, 
  CheckCircle2, 
  ChevronRight, 
  Upload, 
  Loader2, 
  Trash2,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useFairStore } from "@/store/useFairStore";

interface PresenterControlsProps {
  onClose: () => void;
}

export default function PresenterControls({ onClose }: PresenterControlsProps) {
  const { setLocalStream } = useFairStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SANITIZE FILENAME
  const sanitizeFileName = (name: string) => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-zA-Z0-9.\-_]/g, "_") 
      .toLowerCase();
  };

  const withTimeout = <T,>(promise: any, ms: number): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("El servidor tardó demasiado en responder (Timeout)")), ms);
    });

    return Promise.race([
      Promise.resolve(promise).then(res => {
        clearTimeout(timeoutId);
        return res;
      }).catch(err => {
        clearTimeout(timeoutId);
        throw err;
      }),
      timeoutPromise
    ]);
  };

  const updateStage = async (rawType: string, url: string) => {
    try {
        setIsUpdating(true);
        setErrorMsg(null);

        // Auto-correct user errors if they paste a YouTube link in the wrong category
        const lowUrl = url.toLowerCase();
        let type = rawType;
        if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) {
          type = 'youtube';
        } else if (lowUrl.endsWith('.pdf')) {
          type = 'pdf';
        } else if (lowUrl.endsWith('.mp4') || lowUrl.endsWith('.webm') || lowUrl.endsWith('.ogg')) {
          type = 'video';
        } else if (lowUrl.includes('vdo.ninja') || lowUrl.includes('jit.si') || lowUrl.includes('whereby.com')) {
          type = 'meeting';
        }
        
        // Optimistically update the UI to prevent any lagging or "Emitiendo señal" ghosting
        const { setStageState } = useFairStore.getState();
        setStageState({ media_type: type as any, media_url: url, is_live: !!url });

        // Stop local stream hardware tracks to turn off mic/webcam lights
        const currentStream = useFairStore.getState().localStream;
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null); 

        const request = supabase
          .from('auditorium_state')
          .update({ 
            media_type: type, 
            media_url: url,
            is_live: !!url,
            pdf_page: 1,
            updated_at: new Date().toISOString()
          })
          .eq('room', 'auditorio_principal');

        const { error } = (await withTimeout(request, 8000)) as any; // 8 seconds absolute max
        
        if (!error) {
          setTimeout(() => {
            setIsUpdating(false);
            setIsUploading(false); // Make sure this resets too
            setSelectedId(null);
            setUrlInput("");
            onClose(); 
          }, 800);
        } else {
          console.error("Error updating stage DB:", error);
          setErrorMsg(`Error de base de datos: ${error.message}`);
        }
    } catch (err: any) {
        console.error("Excepción al actualizar proyector:", err);
        setErrorMsg(`Error de red: ${err.message || "Fallo de conexión"}`);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    const cleanName = sanitizeFileName(file.name);
    const fileName = `${Date.now()}_${cleanName}`;
    const filePath = `presentations/${fileName}`;

    try {
      console.log("Iniciando subida a bucket 'auditorium'...");
      const uploadReq = supabase.storage
        .from('auditorium')
        .upload(filePath, file, { 
           contentType: file.type || (selectedId === 'pdf' ? 'application/pdf' : 'video/mp4'),
           upsert: true
        });

      const { data, error } = (await withTimeout(uploadReq, 60000)) as any; 

      if (error) {
        console.error("Error detallado de Supabase Storage:", error);
        throw error;
      }

      console.log("Subida exitosa, obteniendo URL pública...");
      const { data: { publicUrl } } = supabase.storage
        .from('auditorium')
        .getPublicUrl(filePath);

      const finalType = selectedId === 'pdf' ? 'pdf' : (selectedId === 'video' ? 'video' : 'youtube');
      await updateStage(finalType, publicUrl);
    } catch (err: any) {
      console.error("Upload error caught:", err);
      setErrorMsg(err.message || "Error al subir archivo. Verifica tamaño, seguridad y conexión.");
    } finally {
      setIsUploading(false); // ABSOLUTE Guarantee that it resets
      // clear the file input so they can click the same file again if they want
      if (fileInputRef.current) {
         fileInputRef.current.value = "";
      }
    }
  };

  const stopBroadcast = async () => {
    try {
        setIsUpdating(true);
        setErrorMsg(null);
        
        // REMOVED OPTIMISTIC UPDATE: We want to see if the DB actually accepts the change
        // Only if the request below succeeds, the UI will change for everyone

        // Synchronize with database
        const request = supabase
          .from('auditorium_state')
          .update({ 
               is_live: false, 
               media_url: '', 
               media_type: 'youtube', 
               updated_at: new Date().toISOString() 
          })
          .eq('room', 'auditorio_principal');
        
        const { error } = (await withTimeout(request, 10000)) as any;
        
        if (error) {
            console.error("Limpiar pantalla error DB:", error);
            setErrorMsg(`Error de sincronización: ${error.message || 'El servidor no responde'}`);
        } else {
            // SUCCESS: Update local store immediately so Admin doesn't wait 5s
            const { setStageState } = useFairStore.getState();
            setStageState({ is_live: false, media_url: '', media_type: 'youtube' });
            onClose();
        }
    } catch (err: any) {
        console.error("Limpiar pantalla excepcion:", err);
        setErrorMsg("Error interno al detener dispositivo.");
    } finally {
        setIsUpdating(false);
    }
  };

  const options = [
    { id: 'youtube', label: 'YouTube Live', icon: <Play size={20} />, color: 'bg-red-500', placeholder: 'URL de YouTube...' },
    { id: 'pdf', label: 'Presentación PDF', icon: <FileText size={20} />, color: 'bg-orange-500', placeholder: 'URL del PDF o usa el botón de subir...' },
    { id: 'video', label: 'Vídeo Local', icon: <Play size={20} />, color: 'bg-purple-500', placeholder: 'URL del vídeo (.mp4, .webm)...' },
    { id: 'meeting', label: 'Sala de Reunión', icon: <Globe size={20} />, color: 'bg-blue-500', placeholder: 'Enlace de Jitsi, Whereby, VDO.ninja...' },
    { id: 'link', label: 'Enlace Externo', icon: <ExternalLink size={20} />, color: 'bg-green-500', placeholder: 'Link de Zoom, Google Meet, Teams...' },
  ];

  const currentOption = options.find(o => o.id === selectedId);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl"
    >
      <input type="file" ref={fileInputRef} className="hidden" accept={selectedId === 'pdf' ? '.pdf' : 'video/*'} onChange={handleFileUpload} />

      <div className="w-full max-w-2xl glass rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-10 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
               <Share2 className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-white">Proyector</h2>
              <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-bold mt-1">Control del Escenario</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* content Area */}
        <div className="p-10 min-h-[350px] flex items-center">
            <AnimatePresence mode="wait">
                {!selectedId ? (
                    <motion.div key="menu" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-2 gap-4 w-full">
                        {options.map((opt) => (
                           <button 
                             key={opt.id} 
                             onClick={() => setSelectedId(opt.id)}
                             className="flex items-center gap-5 p-6 rounded-[2rem] glass border border-white/5 hover:border-primary/50 hover:bg-white/[0.05] transition-all text-left group"
                           >
                              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                 {typeof opt.icon === 'object' ? opt.icon : <Play size={20} />}
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-white/70 group-hover:text-white">{opt.label}</span>
                           </button>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full space-y-10">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setSelectedId(null)} className="text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary flex items-center gap-2">
                                <ChevronRight size={14} className="rotate-180" /> Volver
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Configuración {selectedId}</span>
                        </div>

                        <div className="space-y-6">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-primary transition-colors">
                                    <Globe size={20} />
                                </div>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={urlInput} 
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder={currentOption?.placeholder || "Pega el enlace aquí..."}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 pl-16 pr-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-bold placeholder:text-white/10"
                                />
                            </div>

                            <button 
                                onClick={() => updateStage(selectedId!, urlInput)} 
                                disabled={!urlInput || isUpdating}
                                className="w-full py-6 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.4em] text-[10px] shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Lanzar Proyector
                            </button>

                            {(selectedId === 'pdf' || selectedId === 'video') && (
                                <>
                                    <div className="flex items-center gap-6 py-2">
                                        <div className="h-px bg-white/10 flex-1" />
                                        <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">O TAMBIÉN</span>
                                        <div className="h-px bg-white/10 flex-1" />
                                    </div>

                                    {errorMsg && (
                                       <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-bold">
                                          {errorMsg}
                                       </div>
                                    )}

                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="w-full py-6 rounded-2xl border border-dashed border-white/10 text-white/40 font-black uppercase tracking-[0.3em] text-[10px] hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-3"
                                    >
                                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {isUploading ? 'Procesando Archivo...' : `Subir ${selectedId === 'pdf' ? 'Documento PDF' : 'Archivo de Vídeo'}`}
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-10 bg-black/50 border-t border-white/10 flex items-center justify-end">
           <button onClick={stopBroadcast} className="px-6 py-4 rounded-xl border border-red-500/20 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
               <Trash2 size={18} /> Limpiar Pantalla
           </button>
        </div>
      </div>
    </motion.div>
  );
}
