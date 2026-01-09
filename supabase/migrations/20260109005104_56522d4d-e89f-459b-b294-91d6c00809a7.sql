-- Create planograms table (Base Photos/Master Planograms)
CREATE TABLE public.planograms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  zone TEXT NOT NULL, -- Window, Aisle, Counter, End-cap, etc.
  image_url TEXT NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance tasks table
CREATE TABLE public.vm_compliance_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planogram_id UUID NOT NULL REFERENCES public.planograms(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'one-time', -- one-time, weekly, monthly
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, submitted, approved, rejected, correction_required
  assigned_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create photo submissions table
CREATE TABLE public.vm_photo_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.vm_compliance_tasks(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_address TEXT,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_by TEXT NOT NULL DEFAULT 'Store Manager',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reviews/ratings table
CREATE TABLE public.vm_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.vm_photo_submissions(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.vm_compliance_tasks(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  status TEXT NOT NULL, -- approved, rejected, correction_required
  feedback TEXT,
  annotations JSONB, -- Store annotation data (drawings, markers)
  reviewed_by TEXT NOT NULL DEFAULT 'VM Manager',
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create correction tasks table
CREATE TABLE public.vm_correction_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.vm_reviews(id) ON DELETE CASCADE,
  original_task_id UUID NOT NULL REFERENCES public.vm_compliance_tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.planograms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_compliance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_photo_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_correction_tasks ENABLE ROW LEVEL SECURITY;

-- Create public access policies for planograms
CREATE POLICY "Allow public read access" ON public.planograms FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.planograms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.planograms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.planograms FOR DELETE USING (true);

-- Create public access policies for vm_compliance_tasks
CREATE POLICY "Allow public read access" ON public.vm_compliance_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vm_compliance_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vm_compliance_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vm_compliance_tasks FOR DELETE USING (true);

-- Create public access policies for vm_photo_submissions
CREATE POLICY "Allow public read access" ON public.vm_photo_submissions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vm_photo_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vm_photo_submissions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vm_photo_submissions FOR DELETE USING (true);

-- Create public access policies for vm_reviews
CREATE POLICY "Allow public read access" ON public.vm_reviews FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vm_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vm_reviews FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vm_reviews FOR DELETE USING (true);

-- Create public access policies for vm_correction_tasks
CREATE POLICY "Allow public read access" ON public.vm_correction_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vm_correction_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vm_correction_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vm_correction_tasks FOR DELETE USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_planograms_updated_at
  BEFORE UPDATE ON public.planograms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vm_compliance_tasks_updated_at
  BEFORE UPDATE ON public.vm_compliance_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for VM images
INSERT INTO storage.buckets (id, name, public) VALUES ('vm-images', 'vm-images', true);

-- Create storage policies for vm-images bucket
CREATE POLICY "VM images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'vm-images');
CREATE POLICY "Anyone can upload VM images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vm-images');
CREATE POLICY "Anyone can update VM images" ON storage.objects FOR UPDATE USING (bucket_id = 'vm-images');
CREATE POLICY "Anyone can delete VM images" ON storage.objects FOR DELETE USING (bucket_id = 'vm-images');