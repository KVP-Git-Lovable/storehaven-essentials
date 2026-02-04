-- Add budget columns to nso_store_checklists
ALTER TABLE nso_store_checklists
  ADD COLUMN IF NOT EXISTS prescribed_budget NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_budget NUMERIC DEFAULT 0;

-- Create budget line items table
CREATE TABLE IF NOT EXISTS nso_store_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES nso_store_checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE nso_store_budget_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view budget items"
  ON nso_store_budget_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage budget items"
  ON nso_store_budget_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);