ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_gender_chk;
ALTER TABLE public.leads ADD CONSTRAINT leads_gender_chk CHECK (gender IS NULL OR gender IN ('Male','Female','Other'));

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_gender_chk;
ALTER TABLE public.customers ADD CONSTRAINT customers_gender_chk CHECK (gender IS NULL OR gender IN ('Male','Female','Other'));

ALTER TABLE public.journey_contacts
  ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.journey_contacts DROP CONSTRAINT IF EXISTS journey_contacts_gender_chk;
ALTER TABLE public.journey_contacts ADD CONSTRAINT journey_contacts_gender_chk CHECK (gender IS NULL OR gender IN ('Male','Female','Other'));

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_gender_chk;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_gender_chk CHECK (gender IS NULL OR gender IN ('Male','Female','Other'));