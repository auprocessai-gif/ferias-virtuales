-- ============================================================
-- Exhibitor AI commercial plan tasks
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.exhibitor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'improvement'
    CHECK (type IN ('reply', 'faq', 'improvement')),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'done')),
  title TEXT NOT NULL,
  stand_title TEXT,
  detail TEXT NOT NULL,
  suggested_text TEXT,
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'manual')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.exhibitor_tasks
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'improvement'
    CHECK (type IN ('reply', 'faq', 'improvement')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'done')),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS stand_title TEXT,
  ADD COLUMN IF NOT EXISTS detail TEXT,
  ADD COLUMN IF NOT EXISTS suggested_text TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'manual')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_exhibitor_tasks_event_status
  ON public.exhibitor_tasks(event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exhibitor_tasks_stand
  ON public.exhibitor_tasks(stand_id, created_at DESC);

ALTER TABLE public.exhibitor_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can manage exhibitor tasks" ON public.exhibitor_tasks;
CREATE POLICY "Admins and managers can manage exhibitor tasks"
  ON public.exhibitor_tasks FOR ALL
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

DROP POLICY IF EXISTS "Exhibitors can read event commercial tasks" ON public.exhibitor_tasks;
CREATE POLICY "Exhibitors can read event commercial tasks"
  ON public.exhibitor_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.event_id = exhibitor_tasks.event_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Exhibitors can create event commercial tasks" ON public.exhibitor_tasks;
CREATE POLICY "Exhibitors can create event commercial tasks"
  ON public.exhibitor_tasks FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.event_id = exhibitor_tasks.event_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Exhibitors can update event commercial tasks" ON public.exhibitor_tasks;
CREATE POLICY "Exhibitors can update event commercial tasks"
  ON public.exhibitor_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.event_id = exhibitor_tasks.event_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.event_id = exhibitor_tasks.event_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Exhibitors can delete event commercial tasks" ON public.exhibitor_tasks;
CREATE POLICY "Exhibitors can delete event commercial tasks"
  ON public.exhibitor_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.event_id = exhibitor_tasks.event_id
        AND s.user_id = auth.uid()
    )
  );
