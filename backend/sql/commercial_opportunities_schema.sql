-- ============================================================
-- Commercial opportunities pipeline
-- Turns stand leads into CRM-style opportunities for exhibitors.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.commercial_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stand_id UUID NOT NULL REFERENCES public.stands(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.stand_leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contact_pending', 'contacted', 'interested', 'meeting_scheduled', 'won', 'lost')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  stand_title TEXT,
  contact_label TEXT,
  next_step TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  due_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (lead_id)
);

ALTER TABLE public.commercial_opportunities
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stand_id UUID REFERENCES public.stands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.stand_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contact_pending', 'contacted', 'interested', 'meeting_scheduled', 'won', 'lost')),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS stand_title TEXT,
  ADD COLUMN IF NOT EXISTS contact_label TEXT,
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_opportunities_lead_id
  ON public.commercial_opportunities(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_opportunities_event_status
  ON public.commercial_opportunities(event_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_opportunities_stand
  ON public.commercial_opportunities(stand_id, status, updated_at DESC);

ALTER TABLE public.commercial_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can manage commercial opportunities" ON public.commercial_opportunities;
CREATE POLICY "Admins and managers can manage commercial opportunities"
  ON public.commercial_opportunities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Exhibitors can read own commercial opportunities" ON public.commercial_opportunities;
CREATE POLICY "Exhibitors can read own commercial opportunities"
  ON public.commercial_opportunities FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.id = commercial_opportunities.stand_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Exhibitors can create own commercial opportunities" ON public.commercial_opportunities;
CREATE POLICY "Exhibitors can create own commercial opportunities"
  ON public.commercial_opportunities FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.id = commercial_opportunities.stand_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Exhibitors can update own commercial opportunities" ON public.commercial_opportunities;
CREATE POLICY "Exhibitors can update own commercial opportunities"
  ON public.commercial_opportunities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.id = commercial_opportunities.stand_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.id = commercial_opportunities.stand_id
        AND s.user_id = auth.uid()
    )
  );
