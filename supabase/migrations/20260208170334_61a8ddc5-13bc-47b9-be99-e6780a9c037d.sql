
-- Master table for QA checklist criteria
CREATE TABLE public.grn_qa_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- packaging, temperature, documentation, quality, quantity
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_qa_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view QA criteria" ON public.grn_qa_criteria FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage QA criteria" ON public.grn_qa_criteria FOR ALL USING (auth.uid() IS NOT NULL);

-- Seed default QA criteria
INSERT INTO public.grn_qa_criteria (name, description, category, sort_order) VALUES
  ('Packaging Intact', 'Outer and inner packaging is undamaged', 'packaging', 1),
  ('Seal Unbroken', 'Tamper seals are intact', 'packaging', 2),
  ('Correct Quantity', 'Received quantity matches invoice/PO', 'quantity', 3),
  ('Labeling Correct', 'Labels match product description and are readable', 'documentation', 4),
  ('Expiry Date Valid', 'Products are within acceptable shelf life', 'quality', 5),
  ('Temperature Compliance', 'Items maintained at required temperature during transit', 'temperature', 6),
  ('Invoice Matches PO', 'Invoice details match the purchase order', 'documentation', 7),
  ('No Visible Damage', 'Items show no visible signs of damage or defects', 'quality', 8),
  ('Certificate of Analysis', 'CoA/quality certificate provided where required', 'documentation', 9),
  ('Batch/Lot Number Recorded', 'Batch and lot numbers are clearly marked', 'documentation', 10);

-- GRN line items (items received in each GRN)
CREATE TABLE public.grn_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.grn(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  item_name TEXT NOT NULL,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  accepted_quantity INTEGER NOT NULL DEFAULT 0,
  rejected_quantity INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  qa_status TEXT NOT NULL DEFAULT 'pending', -- pending, passed, failed, partial, on_hold
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage GRN line items" ON public.grn_line_items FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_grn_line_items_grn_id ON public.grn_line_items(grn_id);

-- Per-GRN QA checklist results
CREATE TABLE public.grn_qa_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.grn(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES public.grn_qa_criteria(id),
  result TEXT NOT NULL DEFAULT 'pending', -- pending, pass, fail, na
  remarks TEXT,
  checked_by TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_qa_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage GRN QA results" ON public.grn_qa_results FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_grn_qa_results_grn_id ON public.grn_qa_results(grn_id);
CREATE UNIQUE INDEX idx_grn_qa_results_unique ON public.grn_qa_results(grn_id, criteria_id);

-- Add QA fields to GRN table
ALTER TABLE public.grn
  ADD COLUMN qa_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN qa_overall_result TEXT, -- passed, failed, partial
  ADD COLUMN qa_performed_by TEXT,
  ADD COLUMN qa_performed_at TIMESTAMPTZ,
  ADD COLUMN qa_notes TEXT,
  ADD COLUMN requires_manager_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN manager_decision TEXT, -- approved, rejected, return_to_vendor
  ADD COLUMN manager_decision_by TEXT,
  ADD COLUMN manager_decision_at TIMESTAMPTZ,
  ADD COLUMN manager_comments TEXT,
  ADD COLUMN return_to_vendor_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN return_to_vendor_quantity INTEGER DEFAULT 0,
  ADD COLUMN return_to_vendor_reason TEXT;

-- Updated_at triggers
CREATE TRIGGER update_grn_qa_criteria_updated_at BEFORE UPDATE ON public.grn_qa_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grn_line_items_updated_at BEFORE UPDATE ON public.grn_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
