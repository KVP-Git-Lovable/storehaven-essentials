
ALTER TABLE public.diamond_rates ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT 'VS-EF';
UPDATE public.diamond_rates SET quality = 'VS-EF' WHERE quality IS NULL OR quality = '';
ALTER TABLE public.diamond_rates DROP CONSTRAINT IF EXISTS diamond_rates_particulars_size_label_key;
ALTER TABLE public.diamond_rates ADD CONSTRAINT diamond_rates_quality_particulars_size_label_key UNIQUE (quality, particulars, size_label);

INSERT INTO public.diamond_rates (quality, particulars, size_label, price_per_ct, sort_order) VALUES
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '-2 TO 29 POINTER', 0, 1),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '30 TO 69 CENTS', 0, 2),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '70 TO 99 CENTS', 0, 3),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '1.00 CARAT', 0, 4),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '1.50 CARAT', 0, 5),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '2.00 CARAT', 0, 6),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '2.50 CARAT', 0, 7),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '3.00 CARAT', 0, 8),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '4.00 CARAT', 0, 9),
  ('SOLITAIRE VS1-G', 'ROUND/FANCY', '5.00 CARAT', 0, 10)
ON CONFLICT (quality, particulars, size_label) DO NOTHING;
