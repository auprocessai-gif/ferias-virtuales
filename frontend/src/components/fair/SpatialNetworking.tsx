"use client";

import { usePresence } from "@/context/PresenceProvider";
import { Stand } from "@/../../shared";
import Aura from "./Aura";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SpatialNetworkingProps {
  stands: Stand[];
}

export default function SpatialNetworking({ stands }: SpatialNetworkingProps) {
  const { onlineUsers, presences, userId: currentUserId } = usePresence();
  
  // Helper to get stand position by ID
  const getStandPosition = (standId?: string) => {
    // Default to pavilion entrance if no standId
    if (!standId) return { x: 50, y: 80 }; 
    
    const stand = stands.find(s => s.id === standId);
    
    // Support both formats: flat (position_x) or nested (position.x)
    return {
      x: (stand as any)?.position_x ?? (stand as any)?.position?.x ?? 50,
      y: (stand as any)?.position_y ?? (stand as any)?.position?.y ?? 50
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {/* SVG Container for Filaments (Entanglements) */}
      <svg className="absolute inset-0 w-full h-full">
        {Object.entries(presences).map(([standId, usersAtStand]) => {
          if (usersAtStand.length < 2) return null;
          
          const pos = getStandPosition(standId);
          
          return (
            <g key={`entanglement-${standId}`}>
              {/* Central stand pulse */}
              <motion.circle
                cx={`${pos.x}%`}
                cy={`${pos.y}%`}
                r="10"
                fill="none"
                stroke="#00f2ff"
                strokeWidth="0.5"
                animate={{ scale: [1, 4], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              {/* Connections between users at the same stand */}
              {usersAtStand.map((user, idx) => {
                const nextUser = usersAtStand[(idx + 1) % usersAtStand.length];
                if (user.user_id === nextUser.user_id) return null;
                
                // Add some jitter/offset for Auras around the same stand
                const offset = (idx: number) => ({
                  x: Math.cos(idx * Math.PI * 0.5) * 5,
                  y: Math.sin(idx * Math.PI * 0.5) * 5,
                });

                const start = { x: pos.x + offset(idx).x, y: pos.y + offset(idx).y };
                const end = { x: pos.x + offset((idx + 1) % usersAtStand.length).x, y: pos.y + offset((idx + 1) % usersAtStand.length).y };

                return (
                  <motion.line
                    key={`line-${user.user_id}-${nextUser.user_id}`}
                    x1={`${start.x}%`}
                    y1={`${start.y}%`}
                    x2={`${end.x}%`}
                    y2={`${end.y}%`}
                    stroke="url(#filament-gradient)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: 1, 
                      opacity: [0.1, 0.4, 0.1],
                      strokeDashoffset: [0, -20]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "linear"
                    }}
                  />
                );
              })}
            </g>
          );
        })}
        
        {/* Global Heartbeat Wave Effect */}
        <motion.circle
          cx="50%"
          cy="50%"
          r="100%"
          fill="none"
          stroke="rgba(0, 242, 255, 0.05)"
          strokeWidth="10"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1], opacity: [0.3, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeOut" }}
        />

        <defs>
          <linearGradient id="filament-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2ff" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00f2ff" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* Render Auras */}
      {onlineUsers.map((user, idx) => {
        const pos = getStandPosition(user.current_stand_id);
        
        // Add unique offset based on position_index for stable layout
        const offset = {
          x: Math.cos((user.position_index || 0) * 0.1) * 6,
          y: Math.sin((user.position_index || 0) * 0.1) * 6,
        };

        const finalPos = { x: pos.x + offset.x, y: pos.y + offset.y };

        return (
          <Aura
            key={user.user_id}
            userName={user.user_name}
            isMe={user.user_id === currentUserId}
            status={user.status}
            position={finalPos}
            color={user.current_stand_id ? "#00f2ff" : "#ffffff"}
          />
        );
      })}
    </div>
  );
}
