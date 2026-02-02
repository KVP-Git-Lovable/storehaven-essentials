-- Add new columns to planograms table
ALTER TABLE planograms 
  ADD COLUMN frequency TEXT DEFAULT 'one-time',
  ADD COLUMN schedule_time TIME,
  ADD COLUMN schedule_day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc.
  ADD COLUMN schedule_day_of_month INTEGER, -- 1-31 for specific day
  ADD COLUMN schedule_week_of_month INTEGER, -- 1-4 for which week
  ADD COLUMN schedule_date DATE, -- For one-time specific date
  ADD COLUMN assigned_to_user_id UUID REFERENCES profiles(id);

-- Create junction table for planogram-store relationship (multi-select)
CREATE TABLE planogram_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planogram_id UUID NOT NULL REFERENCES planograms(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(planogram_id, store_id)
);

-- Enable RLS
ALTER TABLE planogram_stores ENABLE ROW LEVEL SECURITY;

-- RLS policies for planogram_stores
CREATE POLICY "Allow authenticated users to view planogram_stores"
  ON planogram_stores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert planogram_stores"
  ON planogram_stores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete planogram_stores"
  ON planogram_stores FOR DELETE
  TO authenticated
  USING (true);