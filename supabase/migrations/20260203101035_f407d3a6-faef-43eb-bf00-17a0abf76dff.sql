-- Add user_id column to leave_balances table to link with profiles
ALTER TABLE public.leave_balances 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON public.leave_balances(user_id);

-- Update RLS policy to also check user_id
DROP POLICY IF EXISTS "Users can view their own leave balances" ON public.leave_balances;
CREATE POLICY "Users can view their own leave balances" 
ON public.leave_balances 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = employee_id OR EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'active'
));