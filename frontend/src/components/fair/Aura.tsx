"use client";

import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles } from "lucide-react";

interface AuraProps {
  userName: string;
  isMe?: boolean;
  status: 'idle' | 'active' | 'viewing';
  position: { x: number; y: number };
  color?: string;
}

export default function Aura({ userName, isMe, status, position, color = "#00f2ff" }: AuraProps) {
  return (
    <motion.div
      className="absolute pointer-events-auto cursor-pointer"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
      transition={{ 
        type: "spring", 
        stiffness: 100, 
        damping: 15,
        opacity: { duration: 0.5 }
      }}
      style={{
        zIndex: 40,
        transform: "translate(-50%, -50%) translateZ(10px)",
      }}
    >
      {/* Outer Pulse Glow */}
      <motion.div 
        className="absolute inset-0 rounded-full blur-xl"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ backgroundColor: color }}
      />

      {/* Core Orb */}
      <div className="relative w-4 h-4 rounded-full border border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.5)] overflow-hidden">
        <div 
          className="absolute inset-0 opacity-80" 
          style={{ 
            background: `radial-gradient(circle at 30% 30%, white 0%, ${color} 60%, black 100%)` 
          }} 
        />
        {/* Swirling energy effect */}
        <motion.div
          className="absolute inset-0 opacity-40 bg-gradient-to-br from-white via-transparent to-white"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Status Indicators */}
      <AnimatePresence>
        {status === 'viewing' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 text-primary drop-shadow-[0_0_5px_rgba(0,242,255,0.8)]"
          >
            <Sparkles size={8} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Fragment (Holographic Label) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 glass px-2 py-1 rounded-md border border-white/10 shadow-2xl">
          {userName} {isMe && "(Tú)"}
        </span>
      </div>
    </motion.div>
  );
}
