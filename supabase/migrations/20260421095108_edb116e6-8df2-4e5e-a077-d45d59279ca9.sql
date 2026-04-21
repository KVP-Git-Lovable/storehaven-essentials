-- Create journey_schedules table
CREATE TABLE public.journey_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL UNIQUE REFERENCES public.journeys(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('one_time', 'recurring')),
  frequency text NULL CHECK (frequency IS NULL OR frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  execution_date date NULL,
  execution_time time NULL,
  days_of_week int[] NULL,
  day_of_month int NULL CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  month_of_quarter int NULL CHECK (month_of_quarter IS NULL OR (month_of_quarter BETWEEN 1 AND 3)),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  next_run_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_journey_schedules_journey_id ON public.journey_schedules(journey_id);
CREATE INDEX idx_journey_schedules_next_run_at ON public.journey_schedules(next_run_at);
CREATE INDEX idx_journey_schedules_type_frequency ON public.journey_schedules(type, frequency);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_journey_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_journey_schedule_trigger
BEFORE INSERT OR UPDATE ON public.journey_schedules
FOR EACH ROW EXECUTE FUNCTION public.validate_journey_schedule();

-- updated_at trigger
CREATE TRIGGER update_journey_schedules_updated_at
BEFORE UPDATE ON public.journey_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.journey_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view journey schedules"
ON public.journey_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert journey schedules"
ON public.journey_schedules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update journey schedules"
ON public.journey_schedules FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete journey schedules"
ON public.journey_schedules FOR DELETE
TO authenticated
USING (true);