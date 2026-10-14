ALTER TABLE auth_refresh_token
    ADD COLUMN successor_token_id BIGINT
        REFERENCES auth_refresh_token (id) ON DELETE SET NULL,
    ADD COLUMN rotation_response_ciphertext TEXT;

CREATE INDEX idx_auth_refresh_tenant_expiry_id
    ON auth_refresh_token (tenant_id, expires_at, id);

CREATE INDEX idx_auth_refresh_tenant_revoked_id
    ON auth_refresh_token (tenant_id, revoked_at, id)
    WHERE revoked_at IS NOT NULL;
