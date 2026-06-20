import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Stand, Event } from '@/../../shared';

export type UserRole = 'participant' | 'admin' | 'manager';

export interface GlobalStageState {
  media_type: 'youtube' | 'pdf' | 'video' | 'meeting' | 'link';
  media_url: string | null;
  pdf_page: number;
  is_live: boolean;
  updated_at: string;
}

interface FairState {
  currentEvent: Event | null;
  selectedStand: Stand | null;
  view: 'pavilion' | 'stand' | 'auditorium';
  userRole: UserRole | null;
  localStream: MediaStream | null;
  stageState: GlobalStageState;
  
  setCurrentEvent: (event: Event) => void;
  setSelectedStand: (stand: Stand | null) => void;
  setView: (view: 'pavilion' | 'stand' | 'auditorium') => void;
  setUserRole: (role: UserRole | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setStageState: (state: Partial<GlobalStageState>) => void;
  syncStage: () => Promise<void>;
  reset: () => void;
}

export const useFairStore = create<FairState>((set) => ({
  currentEvent: null,
  selectedStand: null,
  view: 'pavilion',
  userRole: null,
  localStream: null,
  stageState: {
    media_type: 'youtube',
    media_url: null,
    pdf_page: 1,
    is_live: false,
    updated_at: ''
  },
  
  setCurrentEvent: (event) => set({ currentEvent: event }),
  setSelectedStand: (stand) => set({ selectedStand: stand, view: stand ? 'stand' : 'pavilion' }),
  setView: (view) => set({ view }),
  setUserRole: (role) => set({ userRole: role }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setStageState: (state) => set((prev) => ({ stageState: { ...prev.stageState, ...state } })),
  
  syncStage: async () => {
    try {
      // Cache-buster dummy filter
      const { data, error } = await supabase
        .from('auditorium_state')
        .select('*')
        .eq('room', 'auditorio_principal')
        .neq('updated_at', '1970-01-01T00:00:00Z') 
        .single();
      
      if (data && !error) {
        set({ stageState: data });
      }
    } catch (err) {
      console.warn("Stage Sync Failed:", err);
    }
  },

  reset: () => set({ view: 'pavilion', selectedStand: null, localStream: null, stageState: { media_type: 'youtube', media_url: null, pdf_page: 1, is_live: false, updated_at: '' } }),
}));
