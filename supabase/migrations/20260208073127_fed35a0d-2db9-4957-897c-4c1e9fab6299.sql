
-- Asset Definition Master: custom field definitions per category
CREATE TABLE public.asset_definition_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean', 'textarea')),
  options JSONB DEFAULT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, field_name)
);

-- Custom field values for asset masters
CREATE TABLE public.asset_master_custom_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_master_id UUID NOT NULL REFERENCES public.asset_masters(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.asset_definition_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset_master_id, field_id)
);

-- Enable RLS
ALTER TABLE public.asset_definition_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_master_custom_values ENABLE ROW LEVEL SECURITY;

-- RLS policies for asset_definition_fields
CREATE POLICY "Authenticated users can view asset definition fields"
  ON public.asset_definition_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage asset definition fields"
  ON public.asset_definition_fields FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS policies for asset_master_custom_values
CREATE POLICY "Authenticated users can view custom values"
  ON public.asset_master_custom_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage custom values"
  ON public.asset_master_custom_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_asset_definition_fields_category ON public.asset_definition_fields(category_id);
CREATE INDEX idx_asset_master_custom_values_master ON public.asset_master_custom_values(asset_master_id);
CREATE INDEX idx_asset_master_custom_values_field ON public.asset_master_custom_values(field_id);

-- Auto-update timestamps
CREATE TRIGGER update_asset_definition_fields_updated_at
  BEFORE UPDATE ON public.asset_definition_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
