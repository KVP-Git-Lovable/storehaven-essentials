
-- Create role master enum
CREATE TYPE public.shift_type AS ENUM ('morning', 'afternoon', 'evening', 'night');
CREATE TYPE public.task_category AS ENUM ('cleaning', 'inventory', 'security', 'maintenance', 'customer_service', 'admin');
CREATE TYPE public.task_time_window AS ENUM ('opening', 'periodic', 'closing', 'anytime');
CREATE TYPE public.task_instance_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'escalated', 'handed_over');
CREATE TYPE public.frequency_type AS ENUM ('daily', 'weekly', 'monthly', 'custom');

-- Role Master: Defines shift-based responsibilities
CREATE TABLE public.role_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shift_type shift_type NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frequency Master: Defines repetition logic
CREATE TABLE public.frequency_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  frequency_type frequency_type NOT NULL,
  days_of_week INTEGER[] DEFAULT '{}', -- 0=Sunday, 1=Monday, etc.
  interval_days INTEGER DEFAULT 1, -- For custom: every X days
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Master: Central library of activities
CREATE TABLE public.task_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category task_category NOT NULL,
  sop_image_url TEXT,
  sop_video_url TEXT,
  estimated_duration_mins INTEGER DEFAULT 15,
  requires_photo_evidence BOOLEAN DEFAULT false,
  requires_barcode_scan BOOLEAN DEFAULT false,
  requires_gps_verification BOOLEAN DEFAULT false,
  qr_code_value TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Template: A "Playlist" of tasks for a store
CREATE TABLE public.task_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Template Items: Tasks within a template
CREATE TABLE public.task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.task_template(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.task_master(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role_master(id) ON DELETE SET NULL,
  frequency_id UUID NOT NULL REFERENCES public.frequency_master(id) ON DELETE SET NULL,
  time_window task_time_window NOT NULL DEFAULT 'anytime',
  time_offset_mins INTEGER DEFAULT 0, -- Offset from store open/close
  periodic_interval_mins INTEGER, -- For periodic tasks (e.g., every 120 mins)
  is_mandatory BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1-10, higher is more important
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Instances: Daily generated tasks
CREATE TABLE public.task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_item_id UUID NOT NULL REFERENCES public.task_template_items(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.task_master(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role_master(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  due_time TIME,
  status task_instance_status NOT NULL DEFAULT 'pending',
  assigned_to TEXT, -- Employee who picked up the task
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalated_to TEXT,
  handed_over_from TEXT,
  handed_over_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_item_id, store_id, scheduled_date, scheduled_time)
);

-- Task Completions: Evidence of completion with audit trail
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_instance_id UUID NOT NULL REFERENCES public.task_instances(id) ON DELETE CASCADE,
  completed_by TEXT NOT NULL,
  completion_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_evidence_url TEXT,
  barcode_scanned TEXT,
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  gps_address TEXT,
  device_info JSONB,
  notes TEXT,
  is_on_time BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store Operating Hours: Define open/close times per day
CREATE TABLE public.store_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, day_of_week)
);

-- Task Escalations: Log of escalation alerts
CREATE TABLE public.task_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_instance_id UUID NOT NULL REFERENCES public.task_instances(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL DEFAULT 1, -- 1=warning, 2=overdue, 3=manager alert
  escalated_to TEXT NOT NULL,
  escalation_reason TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.role_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequency_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_escalations ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for now, can be restricted later with auth)
CREATE POLICY "Allow public read access" ON public.role_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.role_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.role_master FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.role_master FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.frequency_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.frequency_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.frequency_master FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.frequency_master FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.task_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.task_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.task_master FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.task_master FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.task_template FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.task_template FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.task_template FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.task_template FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.task_template_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.task_template_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.task_template_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.task_template_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.task_instances FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.task_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.task_instances FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.task_instances FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.task_completions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.task_completions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.task_completions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.task_completions FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.store_operating_hours FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.store_operating_hours FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.store_operating_hours FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.store_operating_hours FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.task_escalations FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.task_escalations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.task_escalations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.task_escalations FOR DELETE USING (true);

-- Insert default frequencies
INSERT INTO public.frequency_master (name, frequency_type, days_of_week, description) VALUES
('Daily', 'daily', '{0,1,2,3,4,5,6}', 'Every day'),
('Weekdays Only', 'weekly', '{1,2,3,4,5}', 'Monday to Friday'),
('Weekends Only', 'weekly', '{0,6}', 'Saturday and Sunday'),
('Weekly - Monday', 'weekly', '{1}', 'Every Monday'),
('Weekly - Friday', 'weekly', '{5}', 'Every Friday'),
('Monthly - 1st', 'monthly', '{}', 'First day of month'),
('Monthly - 15th', 'monthly', '{}', '15th of each month');

-- Insert default roles
INSERT INTO public.role_master (name, shift_type, description) VALUES
('Morning Floor Manager', 'morning', 'Responsible for opening procedures and morning operations'),
('Morning Janitor', 'morning', 'Handles cleaning and maintenance during morning shift'),
('Afternoon Floor Manager', 'afternoon', 'Manages afternoon operations and staff'),
('Afternoon Cashier', 'afternoon', 'Handles checkout and customer service'),
('Evening Floor Manager', 'evening', 'Responsible for closing procedures'),
('Night Security', 'night', 'Overnight security and monitoring');

-- Create trigger for updated_at
CREATE TRIGGER update_role_master_updated_at BEFORE UPDATE ON public.role_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_frequency_master_updated_at BEFORE UPDATE ON public.frequency_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_master_updated_at BEFORE UPDATE ON public.task_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_template_updated_at BEFORE UPDATE ON public.task_template FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_instances_updated_at BEFORE UPDATE ON public.task_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
