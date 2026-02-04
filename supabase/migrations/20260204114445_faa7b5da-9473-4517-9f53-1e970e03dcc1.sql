-- Add store_size_sqft column to stores table
ALTER TABLE public.stores 
ADD COLUMN store_size_sqft numeric(10,2) CHECK (store_size_sqft >= 0);