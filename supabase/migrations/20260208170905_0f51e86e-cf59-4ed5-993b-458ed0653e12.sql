
-- Training Programs table
CREATE TABLE public.training_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  training_type TEXT NOT NULL DEFAULT 'internal', -- internal, external, online, on_the_job
  trainer TEXT,
  department TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  duration_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  score NUMERIC,
  certificate_url TEXT,
  feedback TEXT,
  notes TEXT,
  cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage training programs" ON public.training_programs FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_training_programs_employee ON public.training_programs(employee_id);
CREATE INDEX idx_training_programs_status ON public.training_programs(status);

CREATE TRIGGER update_training_programs_updated_at BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Employee Offboarding table
CREATE TABLE public.employee_offboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  resignation_date DATE NOT NULL,
  last_working_date DATE,
  reason TEXT NOT NULL DEFAULT 'resignation', -- resignation, termination, retirement, contract_end, absconding
  exit_interview_done BOOLEAN DEFAULT false,
  exit_interview_notes TEXT,
  exit_interview_date DATE,
  handover_to TEXT,
  handover_status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  knowledge_transfer_done BOOLEAN DEFAULT false,
  assets_returned BOOLEAN DEFAULT false,
  id_card_returned BOOLEAN DEFAULT false,
  it_access_revoked BOOLEAN DEFAULT false,
  final_settlement_status TEXT DEFAULT 'pending', -- pending, processed, completed
  final_settlement_amount NUMERIC,
  rehire_eligible BOOLEAN DEFAULT true,
  rehire_notes TEXT,
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated, in_progress, completed
  notes TEXT,
  processed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_offboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage offboarding" ON public.employee_offboarding FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_offboarding_employee ON public.employee_offboarding(employee_id);
CREATE INDEX idx_offboarding_status ON public.employee_offboarding(status);

CREATE TRIGGER update_offboarding_updated_at BEFORE UPDATE ON public.employee_offboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add feedback_type to existing employee_feedback
ALTER TABLE public.employee_feedback
  ADD COLUMN feedback_type TEXT NOT NULL DEFAULT 'manager'; -- manager, peer, self, team
