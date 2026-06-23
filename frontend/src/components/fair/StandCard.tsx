"use client";

import { motion } from "framer-motion";
import { Stand } from "@/../../shared";
import { Play, FileText, Info } from "lucide-react";
import { StandTheme, getStandTheme, standThemes } from "./standTheme";

interface StandCardProps {
  stand: Stand;
  onClick: (stand: Stand) => void;
  color?: string;
  theme?: StandTheme;
}

export default function StandCard({ stand, onClick, color = "orange", theme }: StandCardProps) {
  const activeColor = theme || standThemes.find((item) => item.key === color) || getStandTheme(stand);
  const logoSrc = stand.logo_url || stand.images?.[0] || "/placeholder-logo.png";

  return (
    <motion.div
      variants={{
        hidden: { y: 100, opacity: 0, scale: 0.5 },
        visible: { y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 20 } }
      }}
      className="absolute cursor-pointer group"
      style={{
        left: `${stand.position_x ?? 50}%`,
        top: `${stand.position_y ?? 50}%`,
        transform: "translate(-50%, -50%) translateZ(0px)",
        transformStyle: "preserve-3d",
      }}
      whileHover={{ scale: 1.05 }}
      onClick={() => onClick(stand)}
    >
      {/* Stand Structure (Fake 3D Box) */}
      <div className="relative w-36 h-44 transform-gpu preserve-3d">
        {/* Floor shadow */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 bg-black/40 blur-xl rounded-full transform -rotate-x-12" />

        {/* Top/Roof - REDESIGN (Glass White Tech Clean) */}
        <div 
          className="absolute inset-x-0 bottom-0 h-[85%] bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl flex flex-col items-center justify-between p-3 shadow-[0_15px_35px_rgba(0,0,0,0.3)] transform translate-z-10 group-hover:translate-z-30 group-hover:bg-slate-50 transition-all duration-300"
          style={{ borderBottom: `4px solid ${activeColor.hex}` }}
        >
          {/* Logo Area */}
          <div className={`w-14 h-14 rounded-xl bg-white flex items-center justify-center p-2 border ${activeColor.border || "border-white/20"} shadow-inner`}>
            <img src={logoSrc} alt={stand.title} className="w-full h-full object-contain" />
          </div>
          
          <div className="w-full text-center space-y-1">
            <h3
              className="mx-auto max-w-[7.2rem] text-center text-[8.5px] uppercase font-black tracking-widest text-slate-800 leading-[1.15]"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {stand.title}
            </h3>
            <div className={`flex gap-1.5 justify-center ${activeColor.text || ""} opacity-60 group-hover:opacity-100 transition-opacity`} style={{ color: activeColor.hex }}>
              <Play size={8} fill="currentColor" />
              <FileText size={8} />
              <Info size={8} />
            </div>
          </div>

          {/* Stand Indicator Light (Dynamic Glow) */}
          <div 
            className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${activeColor.bg} ${activeColor.shadow} border-2 border-white animate-pulse`}
            style={{ backgroundColor: activeColor.hex, boxShadow: `0 0 15px ${activeColor.hex}` }}
          />
        </div>

        {/* Side Panels (Adding Depth) */}
        <div className="absolute left-0 top-2 bottom-2 w-1 bg-white/5 border-l border-white/10 transform -rotate-y-90 origin-left" />
        <div className="absolute right-0 top-2 bottom-2 w-1 bg-white/5 border-r border-white/10 transform rotate-y-90 origin-right" />
      </div>
    </motion.div>
  );
}
