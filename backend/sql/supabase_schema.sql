-- ============================================================
-- SQL Schema for Virtual Fair Platform (Supabase)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Events Table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  description TEXT,
  banner_url TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.1 Event Managers Table (Association)
CREATE TABLE IF NOT EXISTS public.event_managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, user_id)
);

-- 4. Pavilions Table
CREATE TABLE IF NOT EXISTS public.pavilions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  background_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Stands Table (user_id links stand to its owner/exhibitor)
CREATE TABLE IF NOT EXISTS public.stands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Owner (exhibitor)
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  pavilion_id UUID REFERENCES public.pavilions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  pdf_url TEXT,
  pdf_url_2 TEXT,
  logo_url TEXT,
  website_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  linkedin TEXT,
  instagram TEXT,
  facebook TEXT,
  images TEXT[] DEFAULT '{}',
  theme_color TEXT DEFAULT '#00f2ff',
  position_x FLOAT DEFAULT 50.0,
  position_y FLOAT DEFAULT 50.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Messages Table (for real-time chat)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT 'auditorium', -- 'auditorium' or stand id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pavilions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_managers ENABLE ROW LEVEL SECURITY;

-- 7. Event Managers Policies
CREATE POLICY "Managers can see their assignments" ON public.event_managers
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can manage all assignments" ON public.event_managers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Public read access for catalog data
CREATE POLICY "Public read for companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public read for events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Public read for pavilions" ON public.pavilions FOR SELECT USING (true);
CREATE POLICY "Public read for stands" ON public.stands FOR SELECT USING (true);

-- Exhibitors can update only their own stand
CREATE POLICY "Exhibitors can update their stand" ON public.stands
  FOR UPDATE USING (auth.uid() = user_id);

-- Message policies
CREATE POLICY "Anyone can read messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REALTIME: enable for messages table
-- ============================================================
-- Run this in the Supabase SQL Editor to enable Realtime:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- STORAGE CONFIGURATION
-- ============================================================
-- Insert the bucket (you must configure this via dashboard usually, but SQL can do it if storage schema is accessible)
-- Note: Some of these commands require superuser privileges.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('stands_media', 'stands_media', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
CREATE POLICY "Public can view stands media" ON storage.objects
  FOR SELECT USING (bucket_id = 'stands_media');

CREATE POLICY "Authenticated users can upload stands media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'stands_media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their stands media" ON storage.objects
  FOR UPDATE USING (bucket_id = 'stands_media' AND auth.role() = 'authenticated');

-- ============================================================
-- SEED DATA (one initial event)
-- ============================================================
INSERT INTO public.events (name, slug, description, start_date, end_date)
VALUES (
  'Feria Tecnológica 2026',
  'tecnologica-2026',
  'El mayor evento de innovación futurista del año.',
  now(),
  now() + interval '7 days'
) ON CONFLICT (slug) DO NOTHING;
