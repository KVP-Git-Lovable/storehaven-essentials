-- Security Guards table (personnel onboarding)
CREATE TABLE public.security_guards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  date_of_birth DATE,
  age INTEGER,
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  blood_group TEXT,
  health_notes TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  vendor_id UUID REFERENCES public.vendors(id),
  store_id UUID REFERENCES public.stores(id),
  id_proof_url TEXT,
  address_proof_url TEXT,
  photo_url TEXT,
  references_info JSONB DEFAULT '[]'::jsonb,
  previous_experience JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  login_pin TEXT,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Security Roster Templates (weekly recurring)
CREATE TABLE public.security_roster_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.security_guards(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  shift_type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Security Roster Daily Assignments (specific dates)
CREATE TABLE public.security_roster_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.security_guards(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  assignment_date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled',
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Building Patrol Points (QR code locations)
CREATE TABLE public.security_patrol_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  name TEXT NOT NULL,
  location_description TEXT,
  floor TEXT,
  zone TEXT,
  qr_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Patrol Routes (task master - which points to visit and when)
CREATE TABLE public.security_patrol_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  name TEXT NOT NULL,
  description TEXT,
  shift_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Route Points (points in a route with scheduled times)
CREATE TABLE public.security_route_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.security_patrol_routes(id) ON DELETE CASCADE,
  patrol_point_id UUID NOT NULL REFERENCES public.security_patrol_points(id),
  sequence_order INTEGER NOT NULL,
  scheduled_time TIME NOT NULL,
  tolerance_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Patrol Visits (guard scan records)
CREATE TABLE public.security_patrol_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.security_guards(id),
  patrol_point_id UUID NOT NULL REFERENCES public.security_patrol_points(id),
  route_point_id UUID REFERENCES public.security_route_points(id),
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_time TIME,
  is_on_time BOOLEAN,
  selfie_url TEXT,
  notes TEXT,
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Guard Attendance (daily attendance tracking)
CREATE TABLE public.security_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.security_guards(id),
  roster_daily_id UUID REFERENCES public.security_roster_daily(id),
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'absent',
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Guard Feedback (manager feedback)
CREATE TABLE public.security_guard_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.security_guards(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  submitted_by TEXT NOT NULL,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_ethics_rating INTEGER CHECK (work_ethics_rating >= 1 AND work_ethics_rating <= 5),
  dependability_rating INTEGER CHECK (dependability_rating >= 1 AND dependability_rating <= 5),
  quality_of_service_rating INTEGER CHECK (quality_of_service_rating >= 1 AND quality_of_service_rating <= 5),
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  alertness_rating INTEGER CHECK (alertness_rating >= 1 AND alertness_rating <= 5),
  comments TEXT,
  overall_rating DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gamification Points Log
CREATE TABLE public.security_points_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.security_guards(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.security_guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_roster_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_patrol_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_patrol_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_route_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_patrol_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_guard_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_points_log ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since no auth is implemented yet)
CREATE POLICY "Allow public read access" ON public.security_guards FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_guards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_guards FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_guards FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_roster_templates FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_roster_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_roster_templates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_roster_templates FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_roster_daily FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_roster_daily FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_roster_daily FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_roster_daily FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_patrol_points FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_patrol_points FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_patrol_points FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_patrol_points FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_patrol_routes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_patrol_routes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_patrol_routes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_patrol_routes FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_route_points FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_route_points FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_route_points FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_route_points FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_patrol_visits FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_patrol_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_patrol_visits FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_patrol_visits FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_attendance FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_attendance FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_guard_feedback FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_guard_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.security_guard_feedback FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.security_guard_feedback FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.security_points_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.security_points_log FOR INSERT WITH CHECK (true);

-- Create storage bucket for security documents
INSERT INTO storage.buckets (id, name, public) VALUES ('security-documents', 'security-documents', true);

-- Storage policies for security documents
CREATE POLICY "Public read access for security documents" ON storage.objects FOR SELECT USING (bucket_id = 'security-documents');
CREATE POLICY "Public upload for security documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'security-documents');
CREATE POLICY "Public update for security documents" ON storage.objects FOR UPDATE USING (bucket_id = 'security-documents');
CREATE POLICY "Public delete for security documents" ON storage.objects FOR DELETE USING (bucket_id = 'security-documents');

-- Create updated_at triggers
CREATE TRIGGER update_security_guards_updated_at BEFORE UPDATE ON public.security_guards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_security_patrol_points_updated_at BEFORE UPDATE ON public.security_patrol_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();