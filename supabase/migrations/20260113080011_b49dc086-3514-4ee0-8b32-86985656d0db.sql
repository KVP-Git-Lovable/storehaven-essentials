-- Drop the existing foreign key constraint
ALTER TABLE public.order_items DROP CONSTRAINT order_items_item_id_fkey;

-- Add new foreign key constraint to reference products table
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_item_id_fkey 
FOREIGN KEY (item_id) REFERENCES public.products(id);