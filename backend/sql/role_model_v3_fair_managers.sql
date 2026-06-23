-- ============================================================
-- Role model v3: admin grants fair-specific manager access
-- ============================================================
-- Users remain participants by default. A user can open the dashboard only
-- when they are admin or they have at least one row in event_managers.
-- Managers can never appoint other managers; only admin can manage
-- event_managers rows.

ALTER TABLE public.event_managers
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_managers_event_user_unique
  ON public.event_managers(event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_event_managers_event_user
  ON public.event_managers(event_id, user_id);

CREATE OR REPLACE FUNCTION public.can_manage_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_managers
      WHERE event_id = target_event_id
        AND user_id = auth.uid()
    );
$$;

-- Event manager assignments: visible to admin and to the assigned user,
-- writable only by admin.
ALTER TABLE public.event_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can see their assignments" ON public.event_managers;
DROP POLICY IF EXISTS "Admin can manage all assignments" ON public.event_managers;
DROP POLICY IF EXISTS "Admins can read manager assignments" ON public.event_managers;
DROP POLICY IF EXISTS "Assigned users can read own manager assignments" ON public.event_managers;
DROP POLICY IF EXISTS "Admins can insert manager assignments" ON public.event_managers;
DROP POLICY IF EXISTS "Admins can update manager assignments" ON public.event_managers;
DROP POLICY IF EXISTS "Admins can delete manager assignments" ON public.event_managers;

CREATE POLICY "Admins can read manager assignments"
  ON public.event_managers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Assigned users can read own manager assignments"
  ON public.event_managers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert manager assignments"
  ON public.event_managers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update manager assignments"
  ON public.event_managers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete manager assignments"
  ON public.event_managers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Events: public read remains, but writes are restricted by fair access.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and assigned managers can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can create events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Admins and assigned managers can update events"
  ON public.events FOR UPDATE
  USING (public.can_manage_event(id))
  WITH CHECK (public.can_manage_event(id));

CREATE POLICY "Admins can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Pavilions and stands: writable by admin or assigned managers for that fair.
ALTER TABLE public.pavilions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and assigned managers can manage pavilions" ON public.pavilions;
DROP POLICY IF EXISTS "Admins and assigned managers can manage stands" ON public.stands;

CREATE POLICY "Admins and assigned managers can manage pavilions"
  ON public.pavilions FOR ALL
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Admins and assigned managers can manage stands"
  ON public.stands FOR ALL
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

-- Participants, invitations, analytics and leads: scoped to assigned fair.
DROP POLICY IF EXISTS "Participants can read own event access" ON public.event_participants;
DROP POLICY IF EXISTS "Admins and managers can manage participants" ON public.event_participants;
DROP POLICY IF EXISTS "Users can read invitations addressed to them" ON public.event_invitations;
DROP POLICY IF EXISTS "Admins and managers can manage invitations" ON public.event_invitations;
DROP POLICY IF EXISTS "Admins and managers can read analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "Admins and managers can read leads" ON public.stand_leads;

CREATE POLICY "Participants can read own event access"
  ON public.event_participants FOR SELECT
  USING (user_id = auth.uid() OR public.can_manage_event(event_id));

CREATE POLICY "Admins and assigned managers can manage participants"
  ON public.event_participants FOR ALL
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Users can read invitations addressed to them"
  ON public.event_invitations FOR SELECT
  USING (
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    OR public.can_manage_event(event_id)
  );

CREATE POLICY "Admins and assigned managers can manage invitations"
  ON public.event_invitations FOR ALL
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Admins and assigned managers can read analytics"
  ON public.analytics_events FOR SELECT
  USING (public.can_manage_event(event_id));

CREATE POLICY "Admins and assigned managers can read leads"
  ON public.stand_leads FOR SELECT
  USING (public.can_manage_event(event_id));

-- Keep analytics views subject to the caller RLS policies on their source tables.
ALTER VIEW public.fair_analytics_summary SET (security_invoker = true);
ALTER VIEW public.pavilion_analytics_summary SET (security_invoker = true);
ALTER VIEW public.stand_analytics_summary SET (security_invoker = true);

-- Optional extension points used by exhibitor operations.
DROP POLICY IF EXISTS "Admins and assigned managers can manage stand documents" ON public.stand_documents;
CREATE POLICY "Admins and assigned managers can manage stand documents"
  ON public.stand_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands
      WHERE stands.id = stand_documents.stand_id
        AND public.can_manage_event(stands.event_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stands
      WHERE stands.id = stand_documents.stand_id
        AND public.can_manage_event(stands.event_id)
    )
  );

DROP POLICY IF EXISTS "Admins and managers can manage commercial opportunities" ON public.commercial_opportunities;
CREATE POLICY "Admins and assigned managers can manage commercial opportunities"
  ON public.commercial_opportunities FOR ALL
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

DROP POLICY IF EXISTS "Admins and managers can manage exhibitor tasks" ON public.exhibitor_tasks;
CREATE POLICY "Admins and assigned managers can manage exhibitor tasks"
  ON public.exhibitor_tasks FOR ALL
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));
