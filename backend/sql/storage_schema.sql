-- ============================================================
-- SQL Schema for Auditorium Storage Bucket
-- ============================================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('auditorium', 'auditorium', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (RLS)
-- Allow anyone to read
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'auditorium' );

-- Allow only Admins/Speakers to upload
CREATE POLICY "Speaker Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'auditorium' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'speaker')
  )
);

-- Allow only Admins/Speakers to delete
CREATE POLICY "Speaker Delete Access"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'auditorium' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'speaker')
  )
);
