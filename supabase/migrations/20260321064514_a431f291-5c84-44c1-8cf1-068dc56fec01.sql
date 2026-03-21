
-- Add new columns to employees
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS experience_years numeric,
  ADD COLUMN IF NOT EXISTS previous_experience text,
  ADD COLUMN IF NOT EXISTS aspiration text;

-- Transfer/movement history (tracks store, department, position changes)
CREATE TABLE public.employee_transfer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  from_store_id uuid REFERENCES public.stores(id),
  to_store_id uuid REFERENCES public.stores(id),
  from_department text,
  to_department text,
  from_position text,
  to_position text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_transfer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transfer history"
  ON public.employee_transfer_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transfer history"
  ON public.employee_transfer_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfer history"
  ON public.employee_transfer_history FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete transfer history"
  ON public.employee_transfer_history FOR DELETE TO authenticated USING (true);

-- Performance records (stars + text by manager)
CREATE TABLE public.employee_performance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  review_period text,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_performance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view performance records"
  ON public.employee_performance_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert performance records"
  ON public.employee_performance_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update performance records"
  ON public.employee_performance_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete performance records"
  ON public.employee_performance_records FOR DELETE TO authenticated USING (true);

-- Employee attachments (separate from documents which are identity docs)
CREATE TABLE public.employee_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  description text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employee attachments"
  ON public.employee_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert employee attachments"
  ON public.employee_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update employee attachments"
  ON public.employee_attachments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete employee attachments"
  ON public.employee_attachments FOR DELETE TO authenticated USING (true);
