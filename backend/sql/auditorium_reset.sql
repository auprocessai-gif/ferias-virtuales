-- ============================================================
-- SQL Script: Auditorium Reset and Initial State Sync
-- ============================================================

-- 1. Ensure the standby state is the default
UPDATE public.auditorium_state 
SET 
  is_live = false, 
  media_url = null, 
  media_type = 'youtube', 
  updated_at = timezone('utc'::text, now()) 
WHERE room = 'auditorio_principal';

-- 2. Verify Storage Bucket Permissions (Ensuring Public Access)
-- This ensures that uploaded PDFs and Videos are readable by the projector
UPDATE storage.buckets SET public = true WHERE id = 'auditorium';
