# Security Remediation Notes

## Baseline

- OWASP dependency-check now completes its NVD update path instead of failing on the upstream CVSS v4 parser issue.
- The current dependency scan reports real vulnerability findings in runtime libraries rather than infrastructure parsing errors.
- The highest-priority findings currently involve Tomcat, Netty, Spring Security, and Swagger UI's bundled DOMPurify asset.

## Remediation Strategy

- Prefer BOM-driven upgrades first, starting with the Spring Boot parent and springdoc alignment.
- Keep Swagger/OpenAPI available for local/dev/test, but disable it in staging/prod.
- Keep the dependency-check gate strict so high-severity findings continue to fail CI.
- Avoid blind suppressions; only allow evidence-backed suppressions with expiry and ownership.

## What Was Fixed

- Dependency-check parser compatibility was addressed by upgrading the scanner and wiring NVD API key support.
- CI now uses a warm-update plus no-update scan pattern so security checks are faster and more stable.

## Remaining Risks

- The runtime dependency tree still needs targeted upgrades until the scan is clean.
- Swagger exposure remains a security surface until the profile-based disablement work is complete.
- Any future suppression must be reviewed and time-boxed.

## Suppression Policy

- No blanket suppressions.
- If a suppression is unavoidable, include package path, reason, owner, expiry, and issue link.
- Revisit suppressions whenever the dependency tree changes.

## NVD Key Handling

- Keep the NVD API key in GitHub Actions secrets and local shell state only.
- Do not commit the key, print it in logs, or store it in repo files.
- Rotate the key if it was exposed outside the intended secret store.

## Implementation Status Update (2026-04-08, Security Remediation Pass 2)

- Targeted dependency remediation applied in `velo-platform/pom.xml`:
  - `org.apache.commons:commons-lang3` `3.17.0` -> `3.20.0`
  - `org.apache.logging.log4j:log4j-api` `2.24.3` -> `2.25.4`
  - `org.apache.logging.log4j:log4j-to-slf4j` `2.24.3` -> `2.25.4`
  - `org.webjars:swagger-ui` `5.32.0` -> `5.32.1`
- Runtime compatibility alignment added:
  - `springdoc.swagger-ui.version=5.32.1` in `application.properties` to keep `/swagger-ui/index.html` healthy in local/dev/test after the webjar override.
- CVE comparison (OWASP dependency-check, CVE-only view):
  - Before: 4 unique CVEs (all MEDIUM), max CVSS 6.3, gate status PASS (`failBuildOnCVSS=7`).
  - After: 0 unique CVEs, max CVSS 0.0, gate status PASS.
  - Removed CVEs: `CVE-2025-15599`, `CVE-2025-48924`, `CVE-2025-68161`, `CVE-2026-0540`.
- Validation executed:
  - `./mvnw -q test` (pass)
  - `./mvnw -q -DskipTests package` (pass)
  - `./mvnw -DdataDirectory="$HOME/.cache/odc-data" dependency-check:update-only` (pass)
  - `./mvnw -DdataDirectory="$HOME/.cache/odc-data" -DautoUpdate=false -Dformat=JSON dependency-check:check` (pass)
  - `./mvnw -q -Dtest=DocsEndpointLocalIntegrationTest,DocsEndpointProdIntegrationTest,DocsEndpointStagingIntegrationTest test` (pass)
- Integration caveat:
  - Local compose handshake run requires an active Docker daemon. On this machine, `docker compose up` failed due missing daemon socket (`.../.docker/run/docker.sock`). CI integration workflow remains the required cross-stack gate.
- Suppression policy outcome:
  - No suppressions added in this pass.
