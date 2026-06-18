"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface PresenceState {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  current_stand_id?: string;
  position_index?: number;
  status: 'idle' | 'active' | 'viewing';
  last_ping: string;
}

interface PresenceContextType {
  presences: Record<string, PresenceState[]>;
  onlineUsers: PresenceState[];
  userId: string | null;
  isNexusConnected: boolean;
  updateStatus: (status: PresenceState['status'], standId?: string) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [presences, setPresences] = useState<Record<string, PresenceState[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [isNexusConnected, setIsNexusConnected] = useState(false);
  const latestPresence = useRef<{ status: PresenceState["status"]; standId?: string }>({ status: "active" });

  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentId = user?.id || `guest_${Math.random().toString(36).substring(7)}`;
      const userName = user?.email?.split('@')[0] || 'Visitante';
      
      setUserId(currentId);
      setIsNexusConnected(true); // Heartbeat-based presence is "always" connected via HTTP

      const sendHeartbeat = async (status: PresenceState["status"] = latestPresence.current.status, standId = latestPresence.current.standId) => {
        try {
          await supabase.from('user_presence').upsert({
            user_id: currentId,
            user_name: userName,
            status: status,
            current_stand_id: standId,
            last_ping: new Date().toISOString()
          }, { onConflict: 'user_id' });

          // Also fetch recent active users
          const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
          const { data } = await supabase
            .from('user_presence')
            .select('*')
            .gt('last_ping', thirtySecondsAgo);

          if (data) {
            const activeUsers = data as PresenceState[];
            setOnlineUsers(activeUsers);
            
            const grouped: Record<string, PresenceState[]> = {};
            activeUsers.forEach((p) => {
              if (p.current_stand_id) {
                if (!grouped[p.current_stand_id]) grouped[p.current_stand_id] = [];
                grouped[p.current_stand_id]!.push(p as PresenceState);
              }
            });
            setPresences(grouped);
          }
        } catch (err) {
          console.error("Presence Heartbeat Error:", err);
        }
      };

      // Initial heartbeat
      await sendHeartbeat();

      // Loop heartbeat every 15 seconds
      heartbeatInterval = setInterval(() => {
        // We get current stand from state logic or just send latest known
        sendHeartbeat(latestPresence.current.status, latestPresence.current.standId);
      }, 15000);
    };

    initPresence();

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      setIsNexusConnected(false);
    };
  }, []);

  const updateStatus = async (status: PresenceState['status'], standId?: string) => {
    latestPresence.current = { status, standId };

    if (userId) {
       const { data: { user } } = await supabase.auth.getUser();
       const userName = user?.email?.split('@')[0] || 'Visitante';
       
       await supabase.from('user_presence').upsert({
         user_id: userId,
         user_name: userName,
         status,
         current_stand_id: standId,
         last_ping: new Date().toISOString()
       });
    }
  };

  return (
    <PresenceContext.Provider value={{ presences, onlineUsers, userId, isNexusConnected, updateStatus }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
}
