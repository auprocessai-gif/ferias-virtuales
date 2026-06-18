import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials in frontend .env');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20, // Faster sync for auditorium
    },
    timeout: 30000,        // Extend timeout for slow/unstable WSS connections
  }
});

// Helper for Realtime Status monitoring
if (typeof window !== 'undefined') {
    supabase.channel('system_health')
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
                console.warn("Supabase Realtime Sync Error: Fallbacks are active.");
            }
        });
}
