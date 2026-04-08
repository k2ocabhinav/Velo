# Security Remediation Notes

## Baseline

- OWASP dependency-check completes NVD update path successfully.
- Current dependency scan: 0 unique CVEs after targeted remediation.
- Highest-priority findings (now resolved) involved Tomcat, Netty, Spring Security, and Swagger UI's bundled DOMPurify.

## Remediation Strategy

- Prefer BOM-driven upgrades first, starting with the Spring Boot parent and springdoc alignment.
- Keep Swagger/OpenAPI available for local/dev/test, but disable in staging/prod.
- Keep the dependency-check gate strict so high-severity findings fail CI.
- Avoid blind suppressions; only allow evidence-backed suppressions with expiry and ownership.

## What Was Fixed

- Dependency-check parser compatibility: upgraded scanner + NVD API key support.
- CI uses warm-update + no-update scan pattern for speed and stability.
- Targeted dependency upgrades in `pom.xml`:
  - `commons-lang3` 3.17.0 -> 3.20.0
  - `log4j-api` / `log4j-to-slf4j` 2.24.3 -> 2.25.4
  - `swagger-ui` webjar 5.32.0 -> 5.32.1
  - `springdoc.swagger-ui.version=5.32.1` in `application.properties`
- CVE result: 4 medium CVEs -> 0 CVEs.

## Remaining Risks

- Swagger exposure remains a security surface until profile-based disablement is complete.
- Any future suppression must be reviewed and time-boxed.

## Suppression Policy

- No blanket suppressions.
- If unavoidable: include package path, reason, owner, expiry, and issue link.
- Revisit suppressions whenever the dependency tree changes.

## NVD Key Handling

- Keep the NVD API key in GitHub Actions secrets and local shell state only.
- Do not commit the key, print it in logs, or store it in repo files.
- Rotate the key if exposed outside the intended secret store.
