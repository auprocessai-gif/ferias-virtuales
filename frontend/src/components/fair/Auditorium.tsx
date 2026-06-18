"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ShieldAlert, Radio, Maximize2, Monitor, Video as VideoIcon, Camera, Play, Users, ExternalLink } from "lucide-react";
import ChatPanel from "./ChatPanel";
import PresenterControls from "./PresenterControls";
import { usePresence } from "@/context/PresenceProvider";
import { useFairStore } from "@/store/useFairStore";
import { supabase } from "@/lib/supabase";

interface StageState {
  media_type: 'youtube' | 'pdf' | 'video';
  media_url: string | null;
  pdf_page: number;
  is_live: boolean;
  updated_at: string;
}

export default function Auditorium() {
  const { onlineUsers, updateStatus } = usePresence();
  const { userRole, localStream, stageState, setStageState } = useFairStore();
  const [showChat, setShowChat] = useState(false);
  const [showPresenterPanel, setShowPresenterPanel] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    updateStatus('viewing', 'auditorium');
    
    // RECURSIVE SYNC LOOP (Directly in component for maximum reactivity)
    let syncTimeout: NodeJS.Timeout;
    const runSync = async () => {
      try {
        const { syncStage } = useFairStore.getState();
        await syncStage();
      } finally {
        syncTimeout = setTimeout(runSync, 4000); // 4 Seconds Heartbeat
      }
    };
    
    runSync(); // Immediate first run
    
    return () => {
      updateStatus('active');
      clearTimeout(syncTimeout);
    };
  }, []);

  // Sync stream if localStream (Zustand) is available
  useEffect(() => {
    if (localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, stageState.is_live]);

  // MASTER SWITCH: If not live and no local capture, show Standby
  const isCurrentlyLive = stageState.is_live || !!localStream;
  const isAuthorized = userRole === 'admin' || userRole === 'speaker';
  const viewerCount = onlineUsers.filter(u => u.current_stand_id === 'auditorium').length || 1;

  return (
    <div className="relative w-full h-[90vh] bg-[#111] overflow-hidden flex flex-col items-center justify-center font-geist">
      {/* Background (Full Clarity / Original Look) */}
      <div className="absolute inset-0 bg-[url('/beautiful_auditorium_background.png')] bg-cover bg-center brightness-[0.7] contrast-[1.2] opacity-60 transition-all duration-1000" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      
      <div className="relative z-20 w-full max-w-5xl mt-[-5%] flex flex-col items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full aspect-video rounded-[3rem] overflow-hidden glass border-[1px] border-white/10 shadow-[0_60px_120px_rgba(0,0,0,1)] group bg-black"
        >
          {/* Status Labels */}
          <div className="absolute top-8 left-8 z-[50] flex gap-3">
             <div className={`px-4 py-2 rounded-full backdrop-blur-2xl border flex items-center gap-2 transition-all ${isCurrentlyLive ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-white/5 border-white/10 text-white/40'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isCurrentlyLive ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{isCurrentlyLive ? 'En Directo' : 'Standby'}</span>
             </div>
             {isAuthorized && (
               <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center gap-2">
                 <ShieldAlert size={12} />
                 <span className="text-[9px] font-black uppercase tracking-[0.2em]">{localStream ? 'Capturando Pantalla' : 'Controlador'}</span>
               </div>
             )}
          </div>

          <AnimatePresence mode="wait">
            {!isCurrentlyLive ? (
              <motion.div 
                key="standby"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,255,0.1)_0%,transparent_70%)]" />
                <motion.div 
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="flex flex-col items-center gap-8"
                >
                  <div className="w-24 h-24 rounded-[3rem] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl relative">
                    <div className="absolute inset-0 rounded-[3rem] border border-primary/20 animate-ping opacity-20" />
                    <Radio size={40} className="text-white/20" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-5xl font-black uppercase tracking-[0.6em] text-white/90">STREAMING</h2>
                    <p className="text-[10px] font-black text-primary/60 tracking-[0.5em] uppercase mt-6 flex items-center justify-center gap-4">
                        <span className="w-8 h-px bg-primary/20" /> ESPERANDO SEÑAL <span className="w-8 h-px bg-primary/20" />
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                key={`${stageState.media_type}-${stageState.media_url}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black z-20"
              >
                {/* ALL MEDIA VIEWS */}
                <div className="w-full h-full">
                    {/* 2. PDF VIEW */}
                    {stageState.media_type === 'pdf' && stageState.media_url && (
                        <iframe 
                            key={`pdf-${stageState.media_url}`}
                            src={`${stageState.media_url}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="w-full h-full border-none bg-white"
                        />
                    )}

                    {/* 3. VIDEO VIEW */}
                    {stageState.media_type === 'video' && stageState.media_url && (
                        <video 
                            key={`vid-${stageState.media_url}`}
                            src={stageState.media_url} 
                            controls 
                            autoPlay 
                            className="w-full h-full object-contain"
                        />
                    )}

                    {/* 5. EXTERNAL LINK VIEW (Zoom, Meet, etc.) */}
                    {stageState.media_type === 'link' && stageState.media_url && (
                        <motion.div 
                            key={`link-${stageState.media_url}`}
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-black/60 to-black/90"
                        >
                            <div className="max-w-xl w-full glass rounded-[3rem] p-12 border border-white/10 shadow-2xl text-center space-y-10">
                                <div className="w-24 h-24 rounded-[2rem] bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                                    <ExternalLink className="text-green-400" size={40} />
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-3xl font-black uppercase tracking-widest text-white">Sesión Externa</h3>
                                    <p className="text-white/40 text-sm font-medium leading-relaxed">
                                        Esta presentación se está realizando a través de una plataforma externa para garantizar la máxima calidad. PULSA EL BOTÓN para entrar al directo.
                                    </p>
                                </div>

                                <motion.a 
                                    href={stageState.media_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="block w-full py-6 rounded-[1.5rem] bg-green-500 text-black font-black uppercase text-xs tracking-[0.4em] shadow-2xl shadow-green-500/20 active:bg-green-400 transition-colors"
                                >
                                    ENTRAR AL DIRECTO
                                </motion.a>

                                <div className="pt-4 flex items-center justify-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Emisión en vivo</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* 4. MEETING ROOM (Jitsi, Whereby, etc.) */}
                    {stageState.media_type === 'meeting' && stageState.media_url && (
                        <motion.div 
                            key={`meeting-${stageState.media_url}`}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="w-full h-full bg-black flex items-center justify-center p-0"
                        >
                            <iframe 
                                src={stageState.media_url} 
                                className="w-full h-full border-0 rounded-lg"
                                allow="camera; microphone; display-capture; fullscreen; autoplay"
                                allowFullScreen
                            />
                        </motion.div>
                    )}

                    {stageState.media_type === 'youtube' && stageState.media_url && (
                        <iframe 
                            key={`yt-${stageState.media_url}`}
                            src={`${stageState.media_url.includes('embed') ? stageState.media_url : `https://www.youtube.com/embed/${stageState.media_url.split('v=')[1] || stageState.media_url.split('/').pop()}`}?autoplay=1&mute=0`}
                            className="w-full h-full border-none"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Controller Dock */}
      <div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 glass px-12 py-6 rounded-[3rem] flex items-center gap-12 z-40 border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all duration-700 opacity-50 hover:opacity-100 hover:scale-[1.02]"
        style={{ transform: showChat ? "translateX(calc(-50% - 15rem))" : "translateX(-50%)" }}
      >
        <button 
          onClick={() => setShowChat(!showChat)}
          className={`p-4 rounded-2xl transition-all ${showChat ? "bg-primary text-black" : "text-white/40 hover:text-primary"}`}
        >
          <MessageSquare size={24} />
        </button>
        
        <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-white leading-none">{viewerCount}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mt-2">Audiencia</span>
        </div>

        <div className="h-12 w-px bg-white/10" />

        {isAuthorized ? (
          <button 
            onClick={() => setShowPresenterPanel(true)}
            className="px-10 py-5 rounded-[1.5rem] bg-primary text-black font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20 flex items-center gap-3 active:scale-95 transition-all"
          >
            <Maximize2 size={18} /> Proyector
          </button>
        ) : (
          <div className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-white/20 font-black uppercase text-[9px] tracking-widest cursor-not-allowed">
             Auditorio en Pausa
          </div>
        )}
      </div>

      <AnimatePresence>
        {showChat && <ChatPanel key="chat-panel" onClose={() => setShowChat(false)} />}
        {showPresenterPanel && <PresenterControls key="presenter-panel" onClose={() => setShowPresenterPanel(false)} />}
      </AnimatePresence>
    </div>
  );
}
