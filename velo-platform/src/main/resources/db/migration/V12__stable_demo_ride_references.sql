ALTER TABLE ride ADD COLUMN IF NOT EXISTS external_reference VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ride_tenant_external_reference
    ON ride (tenant_id, external_reference);
