-- Create store transfers table
CREATE TABLE public.store_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number TEXT NOT NULL,
  from_store_id UUID NOT NULL REFERENCES public.stores(id),
  to_store_id UUID NOT NULL REFERENCES public.stores(id),
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  dispatched_at TIMESTAMP WITH TIME ZONE,
  received_by TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store transfer items table
CREATE TABLE public.store_transfer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.store_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  quantity_sent INTEGER,
  quantity_received INTEGER,
  unit_cost NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transfer_items ENABLE ROW LEVEL SECURITY;

-- Create policies for store_transfers
CREATE POLICY "Allow public read access" ON public.store_transfers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.store_transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.store_transfers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.store_transfers FOR DELETE USING (true);

-- Create policies for store_transfer_items
CREATE POLICY "Allow public read access" ON public.store_transfer_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.store_transfer_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.store_transfer_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.store_transfer_items FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_store_transfers_updated_at
  BEFORE UPDATE ON public.store_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();