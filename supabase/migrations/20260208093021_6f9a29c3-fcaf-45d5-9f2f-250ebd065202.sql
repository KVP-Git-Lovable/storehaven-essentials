
-- =============================================
-- STORE PLANS (Expansion Planning)
-- =============================================
CREATE TABLE public.store_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  city TEXT,
  state TEXT,
  region TEXT,
  target_open_date DATE,
  estimated_budget NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  current_approval_level INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view store plans"
  ON public.store_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert store plans"
  ON public.store_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update store plans"
  ON public.store_plans FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "Admins can delete store plans"
  ON public.store_plans FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);

CREATE TRIGGER update_store_plans_updated_at
  BEFORE UPDATE ON public.store_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORE PLAN APPROVAL LEVELS
-- =============================================
CREATE TABLE public.store_plan_approval_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_plan_id UUID NOT NULL REFERENCES public.store_plans(id) ON DELETE CASCADE,
  level_order INT NOT NULL DEFAULT 1,
  approver_role TEXT NOT NULL,
  approver_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_plan_approval_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view approval levels"
  ON public.store_plan_approval_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage approval levels"
  ON public.store_plan_approval_levels FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Approvers can update their own approvals"
  ON public.store_plan_approval_levels FOR UPDATE TO authenticated
  USING (auth.uid() = approver_user_id);

-- =============================================
-- POTENTIAL STORES (Children of Store Plans)
-- =============================================
CREATE TABLE public.potential_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_plan_id UUID NOT NULL REFERENCES public.store_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pin_code TEXT,
  size_sqft NUMERIC,
  status TEXT NOT NULL DEFAULT 'prospective',
  advantages TEXT,
  disadvantages TEXT,
  budget_asked NUMERIC DEFAULT 0,
  available_from DATE,
  contact_person TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.potential_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view potential stores"
  ON public.potential_stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert potential stores"
  ON public.potential_stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins or creators can update potential stores"
  ON public.potential_stores FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "Admins or creators can delete potential stores"
  ON public.potential_stores FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);

CREATE TRIGGER update_potential_stores_updated_at
  BEFORE UPDATE ON public.potential_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- POTENTIAL STORE ATTACHMENTS (Images/Videos)
-- =============================================
CREATE TABLE public.potential_store_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  potential_store_id UUID NOT NULL REFERENCES public.potential_stores(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.potential_store_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON public.potential_store_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert attachments"
  ON public.potential_store_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Admins or uploaders can delete attachments"
  ON public.potential_store_attachments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = uploaded_by);

-- =============================================
-- FRANCHISEES
-- =============================================
CREATE TABLE public.franchisees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  interested_location TEXT,
  city TEXT,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  sign_up_by_date DATE,
  probability TEXT DEFAULT 'medium',
  previous_work_experience TEXT,
  infrastructure_details TEXT,
  current_business_background TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.franchisees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view franchisees"
  ON public.franchisees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert franchisees"
  ON public.franchisees FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins or creators can update franchisees"
  ON public.franchisees FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "Admins or creators can delete franchisees"
  ON public.franchisees FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);

CREATE TRIGGER update_franchisees_updated_at
  BEFORE UPDATE ON public.franchisees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FRANCHISEE DOCUMENTS
-- =============================================
CREATE TABLE public.franchisee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchisee_id UUID NOT NULL REFERENCES public.franchisees(id) ON DELETE CASCADE,
  document_name TEXT,
  document_type TEXT NOT NULL DEFAULT 'general',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.franchisee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view franchisee documents"
  ON public.franchisee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert franchisee documents"
  ON public.franchisee_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Admins or uploaders can delete franchisee documents"
  ON public.franchisee_documents FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = uploaded_by);

-- =============================================
-- FRANCHISEE ONBOARDING CHECKLIST MASTER
-- =============================================
CREATE TABLE public.franchisee_onboarding_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.franchisee_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view onboarding items"
  ON public.franchisee_onboarding_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage onboarding items"
  ON public.franchisee_onboarding_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- =============================================
-- FRANCHISEE ONBOARDING PROGRESS
-- =============================================
CREATE TABLE public.franchisee_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchisee_id UUID NOT NULL REFERENCES public.franchisees(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.franchisee_onboarding_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchisee_id, checklist_item_id)
);

ALTER TABLE public.franchisee_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view onboarding progress"
  ON public.franchisee_onboarding_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert onboarding progress"
  ON public.franchisee_onboarding_progress FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update onboarding progress"
  ON public.franchisee_onboarding_progress FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_franchisee_onboarding_progress_updated_at
  BEFORE UPDATE ON public.franchisee_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE BUCKET for store-plan attachments
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('store-plan-attachments', 'store-plan-attachments', true);

CREATE POLICY "Authenticated users can upload store plan attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-plan-attachments');

CREATE POLICY "Anyone can view store plan attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-plan-attachments');

CREATE POLICY "Authenticated users can delete own store plan attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-plan-attachments');

-- =============================================
-- STORAGE BUCKET for franchisee documents
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('franchisee-documents', 'franchisee-documents', true);

CREATE POLICY "Authenticated users can upload franchisee documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'franchisee-documents');

CREATE POLICY "Anyone can view franchisee documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'franchisee-documents');

CREATE POLICY "Authenticated users can delete own franchisee documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'franchisee-documents');
