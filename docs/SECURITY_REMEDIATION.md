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
