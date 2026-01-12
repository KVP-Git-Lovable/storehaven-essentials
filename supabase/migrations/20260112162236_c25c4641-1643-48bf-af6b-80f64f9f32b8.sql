-- Create store_contacts table for additional contact information
CREATE TABLE public.store_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL DEFAULT 'primary',
  name TEXT NOT NULL,
  designation TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for this app)
CREATE POLICY "Allow all operations on store_contacts" 
ON public.store_contacts 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_store_contacts_updated_at
BEFORE UPDATE ON public.store_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();