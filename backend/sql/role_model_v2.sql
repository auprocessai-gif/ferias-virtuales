-- ============================================================
-- Role model v2: admin, manager and participant
-- ============================================================
-- admin:
--   Global platform owner. Can create and manage every fair.
-- manager:
--   Fair-level operator. Can access only fairs assigned in event_managers.
-- participant:
--   Visitor/attendee. Can enter fairs, but never sees the control panel.

-- 1. Normalize legacy roles no longer used by the product.
UPDATE public.profiles
SET role = 'participant'
WHERE role IN ('exhibitor', 'speaker');

-- 2. Keep mariocaste as global admin and ensure profile email is populated.
UPDATE public.profiles
SET email = 'mariocaste@gmail.com',
    role = 'admin',
    updated_at = timezone('utc'::text, now())
WHERE id = 'aae4d046-3316-4a0d-a0d7-f11591676446';

-- 3. Replace the old role constraint with the canonical three-role model.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'participant'));

-- 4. Optional commercial capacity per fair.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS participant_limit INTEGER;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_participant_limit_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_participant_limit_check
  CHECK (participant_limit IS NULL OR participant_limit > 0);

-- 5. Useful indexes for manager/fair access checks.
CREATE INDEX IF NOT EXISTS idx_event_managers_user_event
  ON public.event_managers(user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_event_status
  ON public.event_participants(event_id, status);
