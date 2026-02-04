-- Add vendor update tracking to service contracts
ALTER TABLE public.service_contracts
ADD COLUMN IF NOT EXISTS vendor_update_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vendor_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.service_contracts.vendor_update_status IS 'Tracks vendor edits: pending_review, reviewed, rejected';
COMMENT ON COLUMN public.service_contracts.vendor_updated_at IS 'Timestamp of last vendor update via public link';