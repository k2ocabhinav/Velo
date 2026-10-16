ALTER TABLE tenant
    ADD COLUMN base_fare NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
    ADD COLUMN per_km_rate NUMERIC(12, 2) NOT NULL DEFAULT 2.00,
    ADD COLUMN minimum_fare NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN service_area_latitude DOUBLE PRECISION,
    ADD COLUMN service_area_longitude DOUBLE PRECISION,
    ADD COLUMN service_area_radius_km DOUBLE PRECISION;

ALTER TABLE tenant
    ADD CONSTRAINT chk_tenant_base_fare_non_negative CHECK (base_fare >= 0),
    ADD CONSTRAINT chk_tenant_per_km_rate_non_negative CHECK (per_km_rate >= 0),
    ADD CONSTRAINT chk_tenant_minimum_fare_non_negative CHECK (minimum_fare >= 0),
    ADD CONSTRAINT chk_tenant_service_area CHECK (
        (service_area_latitude IS NULL AND service_area_longitude IS NULL AND service_area_radius_km IS NULL)
        OR (service_area_latitude IS NOT NULL
            AND service_area_longitude IS NOT NULL
            AND service_area_radius_km IS NOT NULL
            AND service_area_latitude BETWEEN -90 AND 90
            AND service_area_longitude BETWEEN -180 AND 180
            AND service_area_radius_km > 0 AND service_area_radius_km <= 500)
    );

-- Preserve the local default tenant's existing Bengaluru geocoding bias.
UPDATE tenant
SET service_area_latitude = 12.9716,
    service_area_longitude = 77.5946,
    service_area_radius_km = 60.0
WHERE slug = 'default';

-- Apply the Bengaluru chauffeur tariff if this tenant already exists in the environment.
UPDATE tenant
SET base_fare = 250.00,
    per_km_rate = 35.00,
    minimum_fare = 600.00,
    service_area_latitude = 12.9716,
    service_area_longitude = 77.5946,
    service_area_radius_km = 60.0
WHERE slug = 'saffron-routes';
