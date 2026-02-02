-- Add columns to vm_compliance_tasks for photo submission
ALTER TABLE vm_compliance_tasks 
  ADD COLUMN submitted_photo_url TEXT,
  ADD COLUMN submitted_at TIMESTAMPTZ,
  ADD COLUMN submitted_latitude NUMERIC,
  ADD COLUMN submitted_longitude NUMERIC,
  ADD COLUMN submitted_location_address TEXT,
  ADD COLUMN submission_notes TEXT;