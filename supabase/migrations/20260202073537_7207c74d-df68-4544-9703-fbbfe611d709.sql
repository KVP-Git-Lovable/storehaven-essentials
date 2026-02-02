-- Create table for monthly rent entries
CREATE TABLE public.rental_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view rental payments"
  ON public.rental_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rental payments"
  ON public.rental_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rental payments"
  ON public.rental_payments FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete rental payments"
  ON public.rental_payments FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_rental_payments_updated_at
  BEFORE UPDATE ON public.rental_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_rental_payments_rental_id ON public.rental_payments(rental_id);
CREATE INDEX idx_rental_payments_status ON public.rental_payments(status);
CREATE INDEX idx_rental_payments_month_year ON public.rental_payments(month_year);