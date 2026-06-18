-- ============================================================
-- Stand PDF document text for AI copilots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stand_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stand_id UUID NOT NULL REFERENCES public.stands(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  source_url TEXT NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  extraction_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (extraction_status IN ('ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE (stand_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_stand_documents_stand_id
  ON public.stand_documents(stand_id);

CREATE INDEX IF NOT EXISTS idx_stand_documents_event_id
  ON public.stand_documents(event_id);

ALTER TABLE public.stand_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stand documents" ON public.stand_documents;
CREATE POLICY "Authenticated users can read stand documents"
  ON public.stand_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and managers can manage stand documents" ON public.stand_documents;
CREATE POLICY "Admins and managers can manage stand documents"
  ON public.stand_documents FOR ALL
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
