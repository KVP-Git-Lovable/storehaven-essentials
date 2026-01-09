
-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  capacity INTEGER DEFAULT 0,
  lead_time_days INTEGER DEFAULT 1,
  warehouse_type TEXT NOT NULL DEFAULT 'central',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory items table (extends products with inventory tracking)
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  max_stock INTEGER DEFAULT 100,
  expiry_tracking BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock ledger for FIFO tracking
CREATE TABLE public.stock_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_type TEXT NOT NULL, -- 'store' or 'warehouse'
  location_id UUID NOT NULL,
  transaction_type TEXT NOT NULL, -- 'grn', 'sale', 'adjustment', 'transfer', 'consumption', 'rtv'
  quantity_change INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create requisitions table
CREATE TABLE public.requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_number TEXT NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, shipped, delivered
  priority TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create requisition items
CREATE TABLE public.requisition_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  quantity_shipped INTEGER,
  quantity_received INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipments table
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_number TEXT NOT NULL UNIQUE,
  requisition_id UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  carrier_name TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'preparing', -- preparing, dispatched, in_transit, out_for_delivery, delivered
  dispatched_at TIMESTAMP WITH TIME ZONE,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create GRN (Goods Receipt Note) table
CREATE TABLE public.grn (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_number TEXT NOT NULL UNIQUE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  received_by TEXT NOT NULL,
  verified_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, completed
  notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create GRN items for line-item verification
CREATE TABLE public.grn_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.grn(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_expected INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_damaged INTEGER NOT NULL DEFAULT 0,
  quantity_short INTEGER NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  unit_cost NUMERIC NOT NULL,
  damage_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reason codes for stock adjustments
CREATE TABLE public.reason_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'shortage', 'excess', 'damage', 'expiry', 'consumption'
  accounting_impact TEXT NOT NULL, -- 'expense', 'shrinkage', 'cogs', 'write_off'
  requires_approval BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock adjustments table
CREATE TABLE public.stock_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_number TEXT NOT NULL UNIQUE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL, -- 'audit', 'damage', 'expiry', 'consumption', 'correction'
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  reason_code_id UUID NOT NULL REFERENCES public.reason_codes(id) ON DELETE RESTRICT,
  system_quantity INTEGER NOT NULL,
  physical_quantity INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create daily consumption log
CREATE TABLE public.consumption_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  logged_by TEXT NOT NULL,
  consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create RTV (Return to Vendor) table
CREATE TABLE public.rtv (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rtv_number TEXT NOT NULL UNIQUE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, shipped, completed
  total_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create RTV items
CREATE TABLE public.rtv_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rtv_id UUID NOT NULL REFERENCES public.rtv(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  batch_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default reason codes
INSERT INTO public.reason_codes (code, name, category, accounting_impact, requires_approval) VALUES
  ('THEFT', 'Theft/Pilferage', 'shortage', 'shrinkage', true),
  ('DAMAGE', 'Damaged Goods', 'damage', 'write_off', false),
  ('EXPIRY', 'Expired Stock', 'expiry', 'write_off', false),
  ('WASTE', 'Waste/Spoilage', 'shortage', 'expense', false),
  ('COUNT_ERR', 'Counting Error', 'shortage', 'cogs', false),
  ('STORE_USE', 'Store Consumption', 'consumption', 'expense', false),
  ('SAMPLE', 'Sample/Display', 'consumption', 'expense', false),
  ('TRANSFER', 'Inter-Store Transfer', 'shortage', 'cogs', false),
  ('EXCESS', 'Excess Stock Found', 'excess', 'cogs', true),
  ('RETURN', 'Customer Return', 'excess', 'cogs', false);

-- Enable RLS on all tables
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtv_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables
CREATE POLICY "Allow public read access" ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.warehouses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.warehouses FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.inventory_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.inventory_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.stock_ledger FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.stock_ledger FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.stock_ledger FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.stock_ledger FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.requisitions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.requisitions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.requisitions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.requisitions FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.requisition_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.requisition_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.requisition_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.requisition_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.shipments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.shipments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.shipments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.shipments FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.grn FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.grn FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.grn FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.grn FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.grn_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.grn_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.grn_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.grn_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.reason_codes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.reason_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.reason_codes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.reason_codes FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.stock_adjustments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.stock_adjustments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.stock_adjustments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.stock_adjustments FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.consumption_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.consumption_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.consumption_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.consumption_logs FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.rtv FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.rtv FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.rtv FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.rtv FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.rtv_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.rtv_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.rtv_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.rtv_items FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX idx_stock_ledger_item ON public.stock_ledger(item_id);
CREATE INDEX idx_stock_ledger_location ON public.stock_ledger(location_type, location_id);
CREATE INDEX idx_requisitions_store ON public.requisitions(store_id);
CREATE INDEX idx_requisitions_status ON public.requisitions(status);
CREATE INDEX idx_grn_store ON public.grn(store_id);
CREATE INDEX idx_inventory_items_barcode ON public.inventory_items(barcode);
CREATE INDEX idx_inventory_items_sku ON public.inventory_items(sku);
