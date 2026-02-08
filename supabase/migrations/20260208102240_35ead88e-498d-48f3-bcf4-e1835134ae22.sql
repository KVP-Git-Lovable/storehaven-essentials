
-- ============================================
-- Recruitment Pipeline Tables
-- ============================================

-- Job Requisitions
CREATE TABLE public.job_requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  number_of_openings INT NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  requirements TEXT,
  salary_range_min NUMERIC,
  salary_range_max NUMERIC,
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  target_join_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job requisitions"
  ON public.job_requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job requisitions"
  ON public.job_requisitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job requisitions"
  ON public.job_requisitions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete job requisitions"
  ON public.job_requisitions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Candidates
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID REFERENCES public.job_requisitions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  resume_url TEXT,
  current_company TEXT,
  current_designation TEXT,
  experience_years NUMERIC,
  expected_salary NUMERIC,
  notice_period_days INT,
  source TEXT DEFAULT 'direct',
  status TEXT NOT NULL DEFAULT 'applied',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view candidates"
  ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert candidates"
  ON public.candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update candidates"
  ON public.candidates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete candidates"
  ON public.candidates FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Interview Rounds
CREATE TABLE public.interview_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  round_number INT NOT NULL DEFAULT 1,
  round_type TEXT NOT NULL DEFAULT 'screening',
  interviewer_name TEXT,
  interviewer_id UUID,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  rating INT,
  feedback TEXT,
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view interview rounds"
  ON public.interview_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert interview rounds"
  ON public.interview_rounds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update interview rounds"
  ON public.interview_rounds FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete interview rounds"
  ON public.interview_rounds FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Offer Letters
CREATE TABLE public.offer_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  requisition_id UUID REFERENCES public.job_requisitions(id),
  offered_position TEXT NOT NULL,
  offered_department TEXT NOT NULL,
  offered_salary NUMERIC,
  joining_date DATE,
  offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  offer_letter_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view offer letters"
  ON public.offer_letters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert offer letters"
  ON public.offer_letters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update offer letters"
  ON public.offer_letters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete offer letters"
  ON public.offer_letters FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Candidate Documents
CREATE TABLE public.candidate_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view candidate documents"
  ON public.candidate_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert candidate documents"
  ON public.candidate_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update candidate documents"
  ON public.candidate_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete candidate documents"
  ON public.candidate_documents FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================
-- Employee Feedback Table
-- ============================================

CREATE TABLE public.employee_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.profiles(id),
  reviewer_id UUID REFERENCES public.profiles(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employee feedback"
  ON public.employee_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert employee feedback"
  ON public.employee_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update employee feedback"
  ON public.employee_feedback FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete employee feedback"
  ON public.employee_feedback FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage bucket for candidate resumes/documents
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-documents', 'candidate-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view candidate documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-documents');
CREATE POLICY "Authenticated users can upload candidate documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'candidate-documents');
CREATE POLICY "Authenticated users can update candidate documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'candidate-documents');
CREATE POLICY "Authenticated users can delete candidate documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'candidate-documents');
