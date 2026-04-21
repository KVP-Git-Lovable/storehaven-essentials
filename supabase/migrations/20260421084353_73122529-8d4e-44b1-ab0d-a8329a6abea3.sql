ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approval_notes text;

CREATE INDEX IF NOT EXISTS idx_journeys_approval_status ON public.journeys(approval_status);
CREATE INDEX IF NOT EXISTS idx_journeys_approver_id ON public.journeys(approver_id);