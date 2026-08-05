-- Create customer_documents table for storing PAN/Aadhaar uploads
CREATE TABLE IF NOT EXISTS public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('PAN', 'AADHAAR')),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS customer_documents_customer_id_idx ON public.customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS customer_documents_document_type_idx ON public.customer_documents(document_type);
CREATE INDEX IF NOT EXISTS customer_documents_uploaded_at_idx ON public.customer_documents(uploaded_at DESC);

-- Enable RLS on customer_documents table
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to view their own customer's documents
CREATE POLICY "Users can view customer documents" ON public.customer_documents
  FOR SELECT
  USING (
    auth.uid()::text = uploaded_by
    OR EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_documents.customer_id
        AND customers.created_by = auth.uid()::text
    )
  );

-- RLS Policy: Allow authenticated users to insert documents for customers
CREATE POLICY "Users can upload customer documents" ON public.customer_documents
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policy: Allow users to delete their own uploads
CREATE POLICY "Users can delete their own uploads" ON public.customer_documents
  FOR DELETE
  USING (auth.uid()::text = uploaded_by);

-- Add comment for documentation
COMMENT ON TABLE public.customer_documents IS 'Stores uploaded PAN and Aadhaar documents for customers';
COMMENT ON COLUMN public.customer_documents.document_type IS 'Type of document: PAN or AADHAAR';
COMMENT ON COLUMN public.customer_documents.uploaded_by IS 'Email or user ID of the person who uploaded the document';
