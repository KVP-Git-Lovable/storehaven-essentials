-- Add line-level discount columns to order_items table
-- These columns store the discount percentage and fixed amount for dia and making charges on individual product lines

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS dia_discount_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dia_discount_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS making_discount_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS making_discount_amount NUMERIC(12,2) DEFAULT 0;

-- Create index for faster queries on orders by line-level discounts
CREATE INDEX IF NOT EXISTS idx_order_items_discounts
ON order_items(order_id, dia_discount_percent, dia_discount_amount, making_discount_percent, making_discount_amount);
