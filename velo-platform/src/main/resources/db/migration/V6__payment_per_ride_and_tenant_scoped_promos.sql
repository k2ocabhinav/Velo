-- A rider can have many payments; each payment still belongs to one ride.
ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_user_id_key;

-- Promo codes are tenant-owned so admin and rider lookups can enforce isolation.
ALTER TABLE promo_code ADD COLUMN IF NOT EXISTS tenant_id BIGINT DEFAULT 1;
UPDATE promo_code SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE promo_code ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promo_code_tenant ON promo_code (tenant_id);
