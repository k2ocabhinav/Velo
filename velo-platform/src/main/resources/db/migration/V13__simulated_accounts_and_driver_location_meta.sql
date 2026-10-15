ALTER TABLE app_user ADD COLUMN IF NOT EXISTS simulated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE driver ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS location_heading DOUBLE PRECISION;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS location_speed_kph DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_app_user_tenant_simulated ON app_user (tenant_id, simulated);
CREATE INDEX IF NOT EXISTS idx_driver_tenant_location_updated ON driver (tenant_id, location_updated_at);
