-- Create petty_cash table to track petty cash allocations per store
CREATE TABLE public.petty_cash (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create petty_cash_expenses table to track expenses against petty cash
CREATE TABLE public.petty_cash_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  petty_cash_id UUID NOT NULL REFERENCES public.petty_cash(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  expense_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  spent_by TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for petty_cash (public access for now, can be restricted later)
CREATE POLICY "Allow all operations on petty_cash" ON public.petty_cash FOR ALL USING (true) WITH CHECK (true);

-- Create policies for petty_cash_expenses
CREATE POLICY "Allow all operations on petty_cash_expenses" ON public.petty_cash_expenses FOR ALL USING (true) WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_petty_cash_updated_at
  BEFORE UPDATE ON public.petty_cash
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_petty_cash_expenses_updated_at
  BEFORE UPDATE ON public.petty_cash_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();