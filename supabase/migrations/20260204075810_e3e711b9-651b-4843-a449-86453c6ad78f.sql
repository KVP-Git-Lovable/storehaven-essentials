-- Add default purchase date to asset_masters table
ALTER TABLE public.asset_masters 
ADD COLUMN default_purchase_date date;