-- Add user_id column to attendance_records for user-based attendance model
ALTER TABLE public.attendance_records 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Make employee_id nullable since we're moving to user-based model
ALTER TABLE public.attendance_records 
ALTER COLUMN employee_id DROP NOT NULL;

-- Add index for user_id queries
CREATE INDEX idx_attendance_records_user_id ON public.attendance_records(user_id);

-- Update RLS policies for user-based access
DROP POLICY IF EXISTS "Allow authenticated users to read attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Allow authenticated users to insert attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Allow authenticated users to update attendance" ON public.attendance_records;

CREATE POLICY "Users can read all attendance records"
ON public.attendance_records FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own attendance"
ON public.attendance_records FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own attendance"
ON public.attendance_records FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Add face_baseline_url to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS face_baseline_url TEXT;