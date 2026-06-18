-- ============================================================
-- Participant access, invitations, leads and analytics
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Event access configuration
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (registration_mode IN ('open', 'approval_required', 'invite_only'));

-- 2. Participant registration per event
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'pending', 'approved', 'blocked')),
  source TEXT NOT NULL DEFAULT 'self_registration'
    CHECK (source IN ('self_registration', 'invitation', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'pending', 'approved', 'blocked')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self_registration'
    CHECK (source IN ('self_registration', 'invitation', 'admin')),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_event_participants_event_id
  ON public.event_participants(event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_user_id
  ON public.event_participants(user_id);

-- 3. Invitations for private fairs
CREATE TABLE IF NOT EXISTS public.event_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (event_id, email)
);

ALTER TABLE public.event_invitations
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_event_invitations_event_email
  ON public.event_invitations(event_id, email);

-- 4. Fine-grained analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  pavilion_id UUID REFERENCES public.pavilions(id) ON DELETE SET NULL,
  stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pavilion_id UUID REFERENCES public.pavilions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_action_created
  ON public.analytics_events(event_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_pavilion
  ON public.analytics_events(pavilion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_stand
  ON public.analytics_events(stand_id, created_at DESC);

-- 5. Leads generated from meaningful stand interactions
CREATE TABLE IF NOT EXISTS public.stand_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stand_id UUID NOT NULL REFERENCES public.stands(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.stand_leads
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stand_id UUID REFERENCES public.stands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_stand_leads_event_stand
  ON public.stand_leads(event_id, stand_id, created_at DESC);

-- 6. Admin/exhibitor-friendly aggregate views
CREATE OR REPLACE VIEW public.fair_analytics_summary AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.slug,
  COUNT(DISTINCT ae.id) FILTER (WHERE ae.action = 'fair_entered') AS fair_entries,
  COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.action = 'fair_entered') AS unique_visitors,
  COUNT(DISTINCT ae.id) FILTER (WHERE ae.action = 'pavilion_entered') AS pavilion_entries,
  COUNT(DISTINCT ae.id) FILTER (WHERE ae.action = 'stand_viewed') AS stand_views,
  COUNT(DISTINCT ae.id) FILTER (WHERE ae.action = 'auditorium_entered') AS auditorium_entries,
  COUNT(DISTINCT sl.id) AS leads,
  COUNT(DISTINCT ep.id) AS registered_participants
FROM public.events e
LEFT JOIN public.analytics_events ae ON ae.event_id = e.id
LEFT JOIN public.stand_leads sl ON sl.event_id = e.id
LEFT JOIN public.event_participants ep ON ep.event_id = e.id
GROUP BY e.id, e.title, e.slug;

CREATE OR REPLACE VIEW public.pavilion_analytics_summary AS
SELECT
  p.id AS pavilion_id,
  p.event_id,
  p.name AS pavilion_name,
  COUNT(ae.id) FILTER (WHERE ae.action = 'pavilion_entered') AS visits,
  COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.action = 'pavilion_entered') AS unique_visitors
FROM public.pavilions p
LEFT JOIN public.analytics_events ae ON ae.pavilion_id = p.id
GROUP BY p.id, p.event_id, p.name;

CREATE OR REPLACE VIEW public.stand_analytics_summary AS
SELECT
  s.id AS stand_id,
  s.event_id,
  s.pavilion_id,
  s.title AS stand_title,
  COUNT(DISTINCT ae.id) FILTER (WHERE ae.action = 'stand_viewed') AS views,
  COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.action = 'stand_viewed') AS unique_visitors,
  COUNT(DISTINCT sl.id) AS leads
FROM public.stands s
LEFT JOIN public.analytics_events ae ON ae.stand_id = s.id
LEFT JOIN public.stand_leads sl ON sl.stand_id = s.id
GROUP BY s.id, s.event_id, s.pavilion_id, s.title;

-- 7. RLS
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stand_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read own event access"
  ON public.event_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Participants can self register"
  ON public.event_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and managers can manage participants"
  ON public.event_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can read invitations addressed to them"
  ON public.event_invitations FOR SELECT
  USING (
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can manage invitations"
  ON public.event_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can accept own pending invitations"
  ON public.event_invitations FOR UPDATE
  USING (
    status = 'pending'
    AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    status = 'accepted'
    AND accepted_by = auth.uid()
    AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "Authenticated users can write analytics"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can read analytics"
  ON public.analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Authenticated users can create stand leads"
  ON public.stand_leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can read leads"
  ON public.stand_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
