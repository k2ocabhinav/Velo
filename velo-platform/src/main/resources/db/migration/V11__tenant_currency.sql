ALTER TABLE tenant_configuration
    ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    ADD CONSTRAINT chk_tenant_configuration_currency CHECK (currency ~ '^[A-Z]{3}$');
