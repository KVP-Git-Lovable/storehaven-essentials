-- Add new fields to asset_masters for ice cream store equipment management
ALTER TABLE public.asset_masters
ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
ADD COLUMN IF NOT EXISTS model VARCHAR(100),
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150),
ADD COLUMN IF NOT EXISTS sku VARCHAR(50),
ADD COLUMN IF NOT EXISTS upc_barcode VARCHAR(50),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(30) DEFAULT 'unit',
ADD COLUMN IF NOT EXISTS standard_price NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS dimensions_cm VARCHAR(50),
ADD COLUMN IF NOT EXISTS power_consumption_watts INTEGER,
ADD COLUMN IF NOT EXISTS voltage_requirement VARCHAR(30),
ADD COLUMN IF NOT EXISTS temperature_range VARCHAR(50),
ADD COLUMN IF NOT EXISTS capacity VARCHAR(100),
ADD COLUMN IF NOT EXISTS refrigerant_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS energy_rating VARCHAR(20),
ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS expected_lifespan_years INTEGER,
ADD COLUMN IF NOT EXISTS maintenance_frequency VARCHAR(30),
ADD COLUMN IF NOT EXISTS certification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certifications TEXT[],
ADD COLUMN IF NOT EXISTS safety_requirements TEXT,
ADD COLUMN IF NOT EXISTS installation_requirements TEXT,
ADD COLUMN IF NOT EXISTS spare_parts_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER,
ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disposal_instructions TEXT,
ADD COLUMN IF NOT EXISTS environment_impact VARCHAR(50),
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS datasheet_url TEXT,
ADD COLUMN IF NOT EXISTS manual_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.asset_masters.brand IS 'Brand name of the asset e.g. Blue Star, Voltas';
COMMENT ON COLUMN public.asset_masters.model IS 'Model number/name';
COMMENT ON COLUMN public.asset_masters.manufacturer IS 'Manufacturer/OEM name';
COMMENT ON COLUMN public.asset_masters.hsn_code IS 'HSN code for GST in India';
COMMENT ON COLUMN public.asset_masters.temperature_range IS 'Operating temperature range e.g. -20°C to -18°C for freezers';
COMMENT ON COLUMN public.asset_masters.capacity IS 'Storage/operational capacity e.g. 500L for freezer';
COMMENT ON COLUMN public.asset_masters.refrigerant_type IS 'Type of refrigerant used e.g. R134a, R290';
COMMENT ON COLUMN public.asset_masters.energy_rating IS 'BEE star rating for India';