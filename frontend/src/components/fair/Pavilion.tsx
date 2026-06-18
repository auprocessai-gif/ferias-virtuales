"use client";

import { motion, useMotionValue } from "framer-motion";
import { useRef } from "react";
import { Stand } from "@/../../shared";
import StandCard from "./StandCard";
import SpatialNetworking from "./SpatialNetworking";
import { Building2, MousePointer2 } from "lucide-react";
import { DEFAULT_STAND_THEME_COLOR, getPaletteStandTheme, getStandTheme, isHexColor } from "./standTheme";

interface PavilionProps {
  stands: Stand[];
  pavilionName?: string;
  isLoading?: boolean;
  onStandClick: (stand: Stand) => void;
}

export default function Pavilion({ stands, pavilionName, isLoading = false, onStandClick }: PavilionProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const container = constraintsRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const maxX = Math.max(0, (3000 - width) / 2);
    const maxY = Math.max(0, (2000 - height) / 2);
    const wheelScale = event.deltaMode === 1 ? 18 : 1;
    const horizontalDelta = event.shiftKey ? event.deltaY : event.deltaX;
    const verticalDelta = event.shiftKey ? 0 : event.deltaY;

    x.set(clamp(x.get() - horizontalDelta * wheelScale, -maxX, maxX));
    y.set(clamp(y.get() - verticalDelta * wheelScale, -maxY, maxY));
  };

  return (
    <div
      ref={constraintsRef}
      onWheel={handleWheel}
      className="relative w-full h-[90vh] overflow-hidden bg-[#080b12]"
    >
      {/* Dynamic Background Atmosphere */}
      <div className="absolute inset-0 bg-[url('/images/pavilion_bg.png')] bg-cover bg-center opacity-40 mix-blend-screen pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#080b12]/0 via-[#080b12]/40 to-[#080b12] pointer-events-none" />
      
      {/* 3D Scene Viewport */}
      <div className="absolute inset-0 flex items-center justify-center transform-gpu preserve-3d perspective-[2500px]">
        {/* Infinite Draggable Canvas */}
        <motion.div 
          drag
          dragConstraints={constraintsRef}
          dragElastic={0.05}
          dragMomentum={true}
          whileDrag={{ scale: 0.98, cursor: "grabbing" }}
          style={{ x, y }}
          className="relative w-[3000px] h-[2000px] flex items-center justify-center cursor-grab transform-gpu preserve-3d"
        >
          {/* Floor Plane with the new High-Res View */}
          <motion.div 
            className="relative w-full h-full bg-[#050505] rounded-[4rem] border border-white/10 shadow-[0_0_150px_rgba(0,242,255,0.1)] overflow-hidden"
            style={{
              transform: "rotateX(25deg) rotateZ(0deg)",
              transformStyle: "preserve-3d",
            }}
            initial={{ opacity: 0, y: 300, rotateX: 45 }}
            animate={{ opacity: 1, y: 0, rotateX: 25 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            /* Empujamos un poco hacia atrás el plano entero para que la perspectiva X resista el tamaño masivo */
          >
            {/* The Actual Generated Background */}
            <div 
              className="absolute inset-0 bg-[url('/images/pavilion_bg.png')] bg-cover bg-center brightness-125 contrast-110"
              style={{ transform: "scale(1.1)" }}
            />
            
            {/* Glowing Overlay Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,242,255,0.05)_2px,transparent_2px),linear-gradient(90deg,rgba(0,242,255,0.05)_2px,transparent_2px)] bg-[size:120px_120px]" />

            {/* Spatial Networking Layer */}
            <SpatialNetworking stands={stands} />

            {/* Render Stands in 3D Space */}
            <motion.div 
              className="absolute inset-0 p-12 transform-gpu preserve-3d"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.8 } }
              }}
              initial="hidden"
              animate="visible"
            >
              {stands.map((stand, index) => {
                // Lógica de "dispersión" mejorada para que no se pisen los stands nuevos (en posición 50,50)
                const samePosCount = stands.slice(0, index).filter(s => 
                  (s.position_x || 50) === (stand.position_x || 50) && 
                  (s.position_y || 50) === (stand.position_y || 50)
                ).length;
                
                // Si hay colisión, aplicamos un patrón circular/espiral para dispersarlos
                let offsetX = 0;
                let offsetY = 0;
                
                if (samePosCount > 0) {
                  const angle = (samePosCount * (360 / 8)) * (Math.PI / 180); // Círculo de 8 posiciones
                  const radius = 22; // Radio aumentado significativamente para evitar colisiones reales
                  offsetX = Math.cos(angle) * radius;
                  offsetY = Math.sin(angle) * (radius * 0.4); // Perspectiva más chata en Y
                }

                const savedColor = stand.theme_color?.toLowerCase();
                const hasSavedCustomColor = Boolean(savedColor && isHexColor(savedColor) && savedColor !== DEFAULT_STAND_THEME_COLOR);
                const accentTheme = hasSavedCustomColor
                  ? getStandTheme(stand, index)
                  : getPaletteStandTheme(index);
                const themedStand = {
                  ...stand,
                  theme_color: accentTheme.hex,
                  position_x: (stand.position_x || 50) + offsetX,
                  position_y: (stand.position_y || 50) + offsetY
                };

                return (
                  <StandCard 
                    key={stand.id} 
                    theme={accentTheme}
                    stand={themedStand} 
                    onClick={onStandClick} 
                  />
                );
              })}
            </motion.div>

            {stands.length === 0 && (
              <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <div className="rounded-2xl border border-white/15 bg-black/55 px-10 py-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-black">
                    <Building2 size={24} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
                    {isLoading ? "Cargando stands" : "Pabellón vacío"}
                  </p>
                  <h3 className="mt-3 text-2xl font-black uppercase tracking-normal text-white">
                    {pavilionName || "Este pabellon"}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
                    {isLoading
                      ? "Estamos preparando el mapa de este pabellón."
                      : "Aún no hay stands publicados aquí. Puedes cambiar de pabellón o volver más tarde."}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Modern Float HUD - REDESIGN (Orange High Contrast) */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-orange-600/90 backdrop-blur-3xl px-10 py-5 rounded-[2.5rem] flex items-center gap-8 z-30 border-2 border-white/30 shadow-[0_0_100px_rgba(255,81,0,0.3)] pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
            <MousePointer2 className="text-orange-600 animate-bounce" size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] uppercase font-black tracking-widest text-white/60">Mapa Interactivo</span>
            <span className="text-[14px] uppercase font-black tracking-[0.2em] text-white">
               {pavilionName || "Gestor de Pabellones"}
            </span>
          </div>
        </div>
        <div className="h-10 w-px bg-white/20" />
        <span className="text-[10px] font-black text-white/70 uppercase tracking-widest leading-relaxed">
           Mueve el mapa completo<br/>
           <span className="text-white">Arrastra o usa la rueda</span>
        </span>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
