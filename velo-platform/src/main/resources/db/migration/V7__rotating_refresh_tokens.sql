CREATE TABLE auth_refresh_token (
    id BIGSERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    family_id VARCHAR(36) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    revoked_at TIMESTAMP,
    version BIGINT
);

CREATE INDEX idx_auth_refresh_family_tenant
    ON auth_refresh_token (family_id, tenant_id);

CREATE INDEX idx_auth_refresh_user_tenant
    ON auth_refresh_token (user_id, tenant_id);
