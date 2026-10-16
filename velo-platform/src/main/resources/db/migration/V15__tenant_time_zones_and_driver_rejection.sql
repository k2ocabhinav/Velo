-- Tenant-local time zone (IANA) so scheduled and recurring trips are interpreted in the
-- tenant's wall clock and stored as UTC instants. Existing tenants default to UTC.
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS time_zone VARCHAR(64) NOT NULL DEFAULT 'UTC';

UPDATE tenant SET time_zone = 'Asia/Kolkata' WHERE slug = 'saffron-routes';

-- Recurring templates keep the local time of day plus the zone it belongs to.
ALTER TABLE recurring_trip_template ADD COLUMN IF NOT EXISTS time_zone VARCHAR(64) NOT NULL DEFAULT 'UTC';

-- Backfill existing templates with their tenant's zone.
UPDATE recurring_trip_template template
SET time_zone = tenant.time_zone
FROM tenant
WHERE template.tenant_id = tenant.id;

-- Admin rejection reason shown back to the driver.
ALTER TABLE driver ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1024);
