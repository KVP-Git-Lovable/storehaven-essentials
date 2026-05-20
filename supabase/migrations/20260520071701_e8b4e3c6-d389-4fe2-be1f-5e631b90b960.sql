
-- Relax type CHECK to allow 'relative'
ALTER TABLE public.journey_schedules DROP CONSTRAINT IF EXISTS journey_schedules_type_check;
ALTER TABLE public.journey_schedules ADD CONSTRAINT journey_schedules_type_check
  CHECK (type = ANY (ARRAY['one_time'::text, 'recurring'::text, 'relative'::text]));

-- New columns
ALTER TABLE public.journey_schedules
  ADD COLUMN IF NOT EXISTS relative_entity text,
  ADD COLUMN IF NOT EXISTS relative_field  text,
  ADD COLUMN IF NOT EXISTS relative_rule   text,
  ADD COLUMN IF NOT EXISTS relative_offset integer,
  ADD COLUMN IF NOT EXISTS relative_unit   text,
  ADD COLUMN IF NOT EXISTS retrigger_mode  text;

ALTER TABLE public.journey_schedules DROP CONSTRAINT IF EXISTS journey_schedules_relative_rule_check;
ALTER TABLE public.journey_schedules ADD CONSTRAINT journey_schedules_relative_rule_check
  CHECK (relative_rule IS NULL OR relative_rule = ANY (ARRAY['before','after','on']));

ALTER TABLE public.journey_schedules DROP CONSTRAINT IF EXISTS journey_schedules_relative_unit_check;
ALTER TABLE public.journey_schedules ADD CONSTRAINT journey_schedules_relative_unit_check
  CHECK (relative_unit IS NULL OR relative_unit = ANY (ARRAY['days','weeks','months']));

ALTER TABLE public.journey_schedules DROP CONSTRAINT IF EXISTS journey_schedules_retrigger_mode_check;
ALTER TABLE public.journey_schedules ADD CONSTRAINT journey_schedules_retrigger_mode_check
  CHECK (retrigger_mode IS NULL OR retrigger_mode = ANY (ARRAY['once','on_change','repeat']));

ALTER TABLE public.journey_schedules DROP CONSTRAINT IF EXISTS journey_schedules_relative_offset_check;
ALTER TABLE public.journey_schedules ADD CONSTRAINT journey_schedules_relative_offset_check
  CHECK (relative_offset IS NULL OR relative_offset >= 0);

-- Update validator
CREATE OR REPLACE FUNCTION public.validate_journey_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'one_time' THEN
    IF NEW.execution_date IS NULL OR NEW.execution_time IS NULL THEN
      RAISE EXCEPTION 'one_time schedules require execution_date and execution_time';
    END IF;
    IF NEW.frequency IS NOT NULL THEN
      RAISE EXCEPTION 'one_time schedules must not have a frequency';
    END IF;
  ELSIF NEW.type = 'recurring' THEN
    IF NEW.frequency IS NULL THEN
      RAISE EXCEPTION 'recurring schedules require a frequency';
    END IF;
    IF NEW.execution_time IS NULL THEN
      RAISE EXCEPTION 'recurring schedules require execution_time';
    END IF;
    IF NEW.frequency = 'weekly' THEN
      IF NEW.days_of_week IS NULL OR array_length(NEW.days_of_week, 1) < 1 THEN
        RAISE EXCEPTION 'weekly schedules require at least one day_of_week';
      END IF;
    ELSIF NEW.frequency IN ('monthly', 'quarterly') THEN
      IF NEW.day_of_month IS NULL OR NEW.day_of_month < 1 OR NEW.day_of_month > 31 THEN
        RAISE EXCEPTION '% schedules require a valid day_of_month (1-31)', NEW.frequency;
      END IF;
    END IF;
  ELSIF NEW.type = 'relative' THEN
    IF NEW.relative_entity IS NULL OR NEW.relative_field IS NULL
       OR NEW.relative_rule IS NULL OR NEW.execution_time IS NULL
       OR NEW.retrigger_mode IS NULL THEN
      RAISE EXCEPTION 'relative schedules require relative_entity, relative_field, relative_rule, execution_time, retrigger_mode';
    END IF;
    IF NEW.relative_rule IN ('before','after') THEN
      IF NEW.relative_offset IS NULL OR NEW.relative_unit IS NULL THEN
        RAISE EXCEPTION 'before/after relative schedules require relative_offset and relative_unit';
      END IF;
    END IF;
    IF NEW.execution_date IS NOT NULL OR NEW.frequency IS NOT NULL
       OR NEW.days_of_week IS NOT NULL OR NEW.day_of_month IS NOT NULL
       OR NEW.month_of_quarter IS NOT NULL THEN
      RAISE EXCEPTION 'relative schedules must not set fixed-date or recurring fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Per-record fire tracking
CREATE TABLE IF NOT EXISTS public.journey_relative_fires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  last_field_value timestamptz,
  last_fired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_journey_relative_fires_journey ON public.journey_relative_fires(journey_id);

ALTER TABLE public.journey_relative_fires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view relative fires" ON public.journey_relative_fires;
DROP POLICY IF EXISTS "Authenticated can insert relative fires" ON public.journey_relative_fires;
DROP POLICY IF EXISTS "Authenticated can update relative fires" ON public.journey_relative_fires;
DROP POLICY IF EXISTS "Authenticated can delete relative fires" ON public.journey_relative_fires;

CREATE POLICY "Authenticated can view relative fires" ON public.journey_relative_fires
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert relative fires" ON public.journey_relative_fires
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update relative fires" ON public.journey_relative_fires
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete relative fires" ON public.journey_relative_fires
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_journey_relative_fires_updated_at ON public.journey_relative_fires;
CREATE TRIGGER update_journey_relative_fires_updated_at
  BEFORE UPDATE ON public.journey_relative_fires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
