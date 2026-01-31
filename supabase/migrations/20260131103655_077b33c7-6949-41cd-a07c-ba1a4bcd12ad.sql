-- =============================================
-- STAFF MANAGEMENT ENHANCEMENT MIGRATION
-- =============================================

-- 1. Extend employees table with additional fields
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id),
ADD COLUMN IF NOT EXISTS aadhar_number TEXT,
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS current_address TEXT,
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
ADD COLUMN IF NOT EXISTS face_baseline_url TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS onboarding_approved_by TEXT,
ADD COLUMN IF NOT EXISTS onboarding_approved_at TIMESTAMP WITH TIME ZONE;

-- 2. Employee Documents table
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- aadhar, pan, address_proof, education, certification
  document_name TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to employee_documents" ON public.employee_documents FOR ALL USING (auth.role() = 'authenticated');

-- 3. Employee Competencies table
CREATE TABLE public.employee_competencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level INTEGER DEFAULT 1 CHECK (proficiency_level BETWEEN 1 AND 5),
  certified BOOLEAN DEFAULT false,
  certification_name TEXT,
  certification_date DATE,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to employee_competencies" ON public.employee_competencies FOR ALL USING (auth.role() = 'authenticated');

-- 4. Manager Feedback table
CREATE TABLE public.manager_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  feedback_by TEXT NOT NULL,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
  attitude_rating INTEGER CHECK (attitude_rating BETWEEN 1 AND 5),
  teamwork_rating INTEGER CHECK (teamwork_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  strengths TEXT,
  areas_of_improvement TEXT,
  action_items TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to manager_feedback" ON public.manager_feedback FOR ALL USING (auth.role() = 'authenticated');

-- 5. Attendance Records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_in_photo_url TEXT,
  check_out_photo_url TEXT,
  check_in_latitude NUMERIC,
  check_in_longitude NUMERIC,
  check_in_address TEXT,
  check_out_latitude NUMERIC,
  check_out_longitude NUMERIC,
  check_out_address TEXT,
  face_match_score NUMERIC,
  status TEXT DEFAULT 'present', -- present, late, half_day, absent
  total_hours NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_employee_date UNIQUE (employee_id, attendance_date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to attendance_records" ON public.attendance_records FOR ALL USING (auth.role() = 'authenticated');
CREATE INDEX idx_attendance_date ON public.attendance_records(attendance_date DESC);
CREATE INDEX idx_attendance_employee ON public.attendance_records(employee_id, attendance_date DESC);

-- 6. Leave Types table
CREATE TABLE public.leave_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_paid BOOLEAN DEFAULT true,
  max_per_year INTEGER DEFAULT 12,
  carry_forward BOOLEAN DEFAULT false,
  max_carry_forward INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT true,
  min_notice_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to leave_types" ON public.leave_types FOR ALL USING (auth.role() = 'authenticated');

-- Insert default leave types
INSERT INTO public.leave_types (name, description, is_paid, max_per_year, carry_forward) VALUES
('Casual Leave', 'For personal matters', true, 12, false),
('Sick Leave', 'For health issues', true, 10, true),
('Annual Leave', 'Vacation/holiday', true, 15, true),
('Comp-off', 'Compensatory off for extra work', true, 0, false),
('Loss of Pay', 'Unpaid leave', false, 0, false);

-- 7. Leave Balances table
CREATE TABLE public.leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  opening_balance NUMERIC DEFAULT 0,
  granted NUMERIC DEFAULT 0,
  used NUMERIC DEFAULT 0,
  lapsed NUMERIC DEFAULT 0,
  pending NUMERIC DEFAULT 0,
  available NUMERIC GENERATED ALWAYS AS (opening_balance + granted - used - lapsed - pending) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_employee_leave_year UNIQUE (employee_id, leave_type_id, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to leave_balances" ON public.leave_balances FOR ALL USING (auth.role() = 'authenticated');

-- 8. Leave Requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count NUMERIC NOT NULL,
  half_day_type TEXT, -- first_half, second_half, null for full day
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to leave_requests" ON public.leave_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id, status);
CREATE INDEX idx_leave_requests_dates ON public.leave_requests(from_date, to_date);

-- 9. Performance Reviews table
CREATE TABLE public.performance_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  reviewed_by TEXT NOT NULL,
  review_date DATE DEFAULT CURRENT_DATE,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  ranking_in_team INTEGER,
  kra_achievement INTEGER, -- percentage
  competency_score INTEGER, -- percentage
  strengths TEXT,
  weaknesses TEXT,
  training_needs TEXT,
  career_interests TEXT,
  promotion_potential TEXT, -- high, medium, low
  next_steps TEXT,
  employee_comments TEXT,
  status TEXT DEFAULT 'draft', -- draft, submitted, acknowledged
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to performance_reviews" ON public.performance_reviews FOR ALL USING (auth.role() = 'authenticated');
CREATE INDEX idx_performance_employee ON public.performance_reviews(employee_id);

-- 10. Training Recommendations
CREATE TABLE public.training_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  review_id UUID REFERENCES public.performance_reviews(id),
  training_topic TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium', -- high, medium, low
  target_completion_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to training_recommendations" ON public.training_recommendations FOR ALL USING (auth.role() = 'authenticated');

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false) ON CONFLICT DO NOTHING;

-- Storage policies for employee documents
CREATE POLICY "Authenticated users can upload employee docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view employee docs" ON storage.objects FOR SELECT USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update employee docs" ON storage.objects FOR UPDATE USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete employee docs" ON storage.objects FOR DELETE USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');