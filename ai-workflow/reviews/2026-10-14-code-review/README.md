# Code Review: 2026-10-14 (first full review after the restart)

**Status:** partial. 2 of 6 reviewers finished before CMD's 5-hour quota ran out. The rest resume after the reset.

| Scope | Model | Result | Report |
|---|---|---|---|
| Backend | deepseek-v4-pro | Done (q5, p0.8) | [backend.deepseek-v4-pro.md](backend.deepseek-v4-pro.md) |
| Backend (head-to-head) | qwen3.8-max-0902 | Quota-killed: resume `888942f7` | — |
| Security | deepseek-v4.1-flash | Done (q5, p0.8) | [security.deepseek-v4.1-flash.md](security.deepseek-v4.1-flash.md) |
| Security (head-to-head) | glm-5.3 | Quota-killed: resume `b5f90d48` | — |
| Frontend | kimi-k3 | Quota-killed: resume `e3fe44ef` | — |
| Tests and ops (runs the suites) | mimo-v2.6-pro | Quota-killed: resume `f0f80c1b` (worktree `review/tests-run`) | — |

Prompts: [prompts/](prompts/). Usage and error data: [raw/results.jsonl](raw/results.jsonl).
Resume with `cmd -p "Continue and produce the final report." --session <id> -m <model> --trust --skip-onboarding --output-format json`.

## Verified by the orchestrator (checked in the code)
1. **Critical:** `POST /auth/onBoardNewDriver/{userId}` is `permitAll` and grants DRIVER to any user (`SecurityConfig.java:45`, `AuthController.java:42`).
2. **Critical:** `payment.user_id BIGINT UNIQUE` plus `@OneToOne Payment.user` means every rider's second paid ride fails (`V1__baseline_schema.sql:104`, `Payment.java:34`).
3. **Critical:** `GET /admin/users` returns `Page<User>` with the BCrypt `password` field serialized (`AdminController.java:120`, `User.java:31`).
4. **Critical:** the reset token is logged in plain text (`AuthServiceImpl.java:179-180`).
5. **Critical:** the dev `jwt.secret` in `application.properties:38` is inherited by prod (no override).
6. **False positive (both reviewers):** "promo usage has no unique constraint". `uq_promo_code_usage` exists in V1. The `currentUses` increment race is still real.

The merged report with all gaps comes after the remaining reviewers finish.
