
-- 1. Requisition store allocations for fulfilment planning by store
CREATE TABLE public.requisition_store_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID NOT NULL REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  positions_count INTEGER NOT NULL DEFAULT 1,
  filled_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requisition_id, store_id)
);
ALTER TABLE public.requisition_store_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage requisition allocations" ON public.requisition_store_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Performance goals for goal setting
CREATE TABLE public.performance_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  review_cycle TEXT NOT NULL DEFAULT '2026',
  goal_title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  weightage INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  self_rating INTEGER,
  self_comments TEXT,
  manager_rating INTEGER,
  manager_comments TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage performance goals" ON public.performance_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Manager feedback entries (multiple times a year)
CREATE TABLE public.manager_feedback_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  review_cycle TEXT NOT NULL DEFAULT '2026',
  feedback_type TEXT NOT NULL DEFAULT 'manager',
  rating INTEGER,
  feedback_text TEXT,
  given_by TEXT,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.manager_feedback_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage feedback entries" ON public.manager_feedback_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. LMS - Learning paths
CREATE TABLE public.learning_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage learning paths" ON public.learning_paths FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. LMS - Learning path trails (sub-paths)
CREATE TABLE public.learning_path_trails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_path_trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage trails" ON public.learning_path_trails FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. LMS - Learning modules
CREATE TABLE public.learning_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trail_id UUID NOT NULL REFERENCES public.learning_path_trails(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'document',
  content_url TEXT,
  content_text TEXT,
  duration_minutes INTEGER DEFAULT 15,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage modules" ON public.learning_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. LMS - Role assignments
CREATE TABLE public.learning_path_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(learning_path_id, role_name)
);
ALTER TABLE public.learning_path_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage path roles" ON public.learning_path_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. LMS - Quiz questions
CREATE TABLE public.learning_module_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_module_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage questions" ON public.learning_module_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. LMS - Enrollments
CREATE TABLE public.learning_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(learning_path_id, employee_id)
);
ALTER TABLE public.learning_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage enrollments" ON public.learning_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. LMS - Quiz attempts
CREATE TABLE public.learning_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB DEFAULT '[]',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage quiz attempts" ON public.learning_quiz_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. LMS - Module completion tracking
CREATE TABLE public.learning_module_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, module_id)
);
ALTER TABLE public.learning_module_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage completions" ON public.learning_module_completions FOR ALL TO authenticated USING (true) WITH CHECK (true);
