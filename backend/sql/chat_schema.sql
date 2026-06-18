-- ============================================================
-- SQL Schema for Live Chat (Auditorium & Networking)
-- ============================================================

-- 1. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT 'auditorio_principal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read messages
CREATE POLICY "Public read messages" ON public.messages FOR SELECT USING (true);

-- Authenticated users can insert their own messages
CREATE POLICY "Authenticated users can insert messages" ON public.messages 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Enable Realtime for Messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
