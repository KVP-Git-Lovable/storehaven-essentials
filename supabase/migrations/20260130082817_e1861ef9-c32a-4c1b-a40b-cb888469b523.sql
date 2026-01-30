-- Drop the incorrect trigger that references 'updated_at' column which doesn't exist
DROP TRIGGER IF EXISTS update_meter_masters_updated_at ON public.meter_masters;

-- Update the Electricity name to 'Electricity (MESCOM)'
UPDATE meter_masters SET name = 'Electricity (MESCOM)' WHERE name = 'Electricity';