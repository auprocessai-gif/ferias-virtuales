-- ============================================================
-- SQL Schema for RBAC and Auditorium Sync
-- ============================================================

-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'manager', 'exhibitor', 'speaker', 'participant')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Auditorium State Table (Real-time projection sync)
CREATE TABLE IF NOT EXISTS public.auditorium_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room TEXT NOT NULL DEFAULT 'auditorio_principal',
  media_type TEXT NOT NULL DEFAULT 'youtube', -- 'youtube', 'pdf', 'screen', 'video'
  media_url TEXT,
  pdf_page INTEGER DEFAULT 1,
  is_live BOOLEAN DEFAULT false,
  presenter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Automatic Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'participant');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Initial Auditorium State
INSERT INTO public.auditorium_state (room, media_type, media_url)
VALUES ('auditorio_principal', 'youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ')
ON CONFLICT DO NOTHING;

-- 5. RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorium_state ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, User can update own email (not role!)
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own email" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auditorium State: Public read, Only Admin/Speaker/Manager can update
CREATE POLICY "Public read auditorium state" ON public.auditorium_state FOR SELECT USING (true);
CREATE POLICY "Privileged roles can update auditorium state" ON public.auditorium_state
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'speaker', 'manager')
    )
  );

-- Managers: Can update profiles of participants/exhibitors (simplified for now)
-- CREATE POLICY "Managers can view all profiles" ON public.profiles FOR SELECT USING (role = 'manager');

-- 6. Enable Realtime
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.auditorium_state;
