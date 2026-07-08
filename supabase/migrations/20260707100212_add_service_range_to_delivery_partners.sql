ALTER TABLE delivery_partners
  ADD COLUMN IF NOT EXISTS service_range_meters int NOT NULL DEFAULT 5000;
