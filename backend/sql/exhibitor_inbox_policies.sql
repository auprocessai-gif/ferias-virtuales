-- ============================================================
-- Exhibitor inbox policies
-- Allows exhibitors to read leads generated on stands assigned to them.
-- ============================================================

CREATE POLICY "Exhibitors can read own stand leads"
  ON public.stand_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.id = stand_leads.stand_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Exhibitors can read own stand analytics"
  ON public.analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stands s
      WHERE s.id = analytics_events.stand_id
        AND s.user_id = auth.uid()
    )
  );
