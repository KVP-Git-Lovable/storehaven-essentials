-- Add array column for multiple days of week selection
ALTER TABLE planograms 
  ADD COLUMN schedule_days_of_week INTEGER[];