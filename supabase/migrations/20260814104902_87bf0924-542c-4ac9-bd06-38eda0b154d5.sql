GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;

ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_face_verification_status_check;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_face_verification_status_check
  CHECK (face_verification_status IS NULL OR face_verification_status = ANY (ARRAY['pending','verifying','matched','mismatch','skipped','blocked']));

ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_user_id_fkey;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_user_date_uidx
  ON public.attendance_records (user_id, attendance_date) WHERE user_id IS NOT NULL;