ALTER TABLE ride_request ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE ride_request ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(64);
ALTER TABLE ride_request ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(1024);
ALTER TABLE ride_request ADD COLUMN IF NOT EXISTS drop_off_address VARCHAR(1024);
ALTER TABLE ride_request ADD COLUMN IF NOT EXISTS external_reference VARCHAR(255);

ALTER TABLE admin_dispatch_audit ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

UPDATE admin_dispatch_audit audit
SET tenant_id = request.tenant_id
FROM ride_request request
WHERE audit.ride_request_id = request.id
  AND audit.tenant_id IS NULL;

UPDATE admin_dispatch_audit audit
SET tenant_id = ride.tenant_id
FROM ride
WHERE audit.ride_id = ride.id
  AND audit.tenant_id IS NULL;

UPDATE admin_dispatch_audit audit
SET tenant_id = app_user.tenant_id
FROM app_user
WHERE audit.actor_user_id = app_user.id
  AND audit.tenant_id IS NULL;

UPDATE admin_dispatch_audit SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE admin_dispatch_audit ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatch_audit_tenant_created ON admin_dispatch_audit (tenant_id, created_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_admin_dispatch_audit_tenant'
    ) THEN
        ALTER TABLE admin_dispatch_audit
            ADD CONSTRAINT fk_admin_dispatch_audit_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenant (id);
    END IF;
END
$$;
