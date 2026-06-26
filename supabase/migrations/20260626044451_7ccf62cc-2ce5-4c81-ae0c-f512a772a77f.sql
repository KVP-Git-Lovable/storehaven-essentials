
-- 1) Remove duplicate enrollments per (journey_id, contact_id), keeping the earliest one.
DELETE FROM public.journey_enrollments a
USING public.journey_enrollments b
WHERE a.journey_id = b.journey_id
  AND a.contact_id = b.contact_id
  AND a.ctid > b.ctid;

-- 2) Enforce uniqueness so future inserts can't create duplicates.
ALTER TABLE public.journey_enrollments
  ADD CONSTRAINT journey_enrollments_journey_contact_unique
  UNIQUE (journey_id, contact_id);
