# Model Scorecard

Last updated: 2026-10-14. Evidence comes from `runs.jsonl`; see `README.md` for the protocol.
Score = mean `quality` for the role (n = number of rated runs). Untested = no evidence yet.

## Rankings by role
Quota-killed runs are logged but excluded from quality means (they say nothing about the model's ability, only its token appetite).

| Role | 1st | 2nd | Notes |
|---|---|---|---|
| review-backend | deepseek-v4-pro (n=1, q=5, p=0.8, 1.5M in / 27k out, 6 min) | _qwen3.8-max-0902: run cut off by quota_ | Found a real functional P0 (payment.user_id UNIQUE) |
| review-security | deepseek-v4.1-flash (n=1, q=5, p=0.8, 2.3M in / 19k out, 6 min) | _glm-5.3: 3.5M in after 8 min with no report_ | A flash model matched a pro-tier review; glm-5.3 is very token-hungry |
| review-frontend | gpt-6-luna:xhigh (n=1, q=5, p=1.0, 6.9M in) | _kimi-k3: pending resume_ | |
| test-ops | gpt-6-luna:xhigh (n=1, q=5, p=1.0; actually ran the suites) | _mimo-v2.6-pro: pending resume_ | |
| synthesis | untested (candidate: kimi-k3, 1M ctx) | | |
| research | gpt-6.1-sol:high via Codex --search (n=2, q=5) | deepseek-v4-flash via CMD (n=1, q=4) | Sol is better sourced; CMD is now restricted to deepseek-v4.1-flash |
| implement | gpt-6-luna:xhigh via Codex (n=6, q=4.8, p=1.0; about 2-15M in per WP, 97% cached) | | Reliable; it stops on broken baselines, and its main faults came from orchestrator prompt errors |
| quick | deepseek-v4-flash / deepseek-v4.1-flash-fast | | cheapest |

## Model quirks (CMD flags)
| Model | Quirk |
|---|---|
| `qwen/*` (3.8-max-0902 confirmed) | `--effort` takes only `low`, `medium` or `xhigh`; `high` exits immediately |
| `xiaomi/mimo-v2.6-pro` | No `--effort` support: passing one exits immediately |
| Codex `exec resume` | Comes back read-only unless `-c sandbox_mode="workspace-write"` is passed again |
| deepseek / kimi / glm | `--effort high` accepted |
| CMD plan quota | A 5-hour usage window. A 6-agent fan-out burned about 10M input tokens in 8 minutes and hit it. Budget about 2-3 full-repo reviewers per window and cap `--max-turns` |
| any model, `-p` mode | Writes and shell need `--yolo` (worktree only, per the project's rules) |

## Catalog snapshot (2026-10-14, `cmd --list-models`, 88 models)
Open-weight coding candidates (newest per family):
- **DeepSeek:** v4-pro (reasoning), v4.1-flash (+vision), v4.1-flash-fast, v4-flash (CMD default). v4-flash is about $0.14/$0.28 per Mtok (web, mid-2026).
- **Qwen:** qwen3.8-max-0902 (strongest coding), qwen3.8-max, qwen3.8-flash (cheap), qwen3.8-27b. Fine for non-commercial use.
- **Kimi:** kimi-k3 (1M ctx, long-horizon), kimi-k2.7-code(-highspeed)
- **GLM:** zai-org/glm-5.3 (security-strong), z-ai/glm-5.3-flash (cheap, 1M ctx)
- **MiniMax:** minimax-m3. **MiMo:** mimo-v2.6-pro, mimo-v2.6-flash. **Others:** step-5-preview, longcat-2.0, mistral-large-4, nemotron-3-ultra
- **Free tiers:** poolside/laguna-s-2.1-free, inclusionai/ling-3.1-flash:free (try these for `quick`)
- **Codex CLI (ChatGPT plan):** `gpt-6-luna` (xhigh) is the default; `gpt-6.1-sol` is the alternative. The user's rule: never `gpt-6-astra` (token-hungry) or older models.
- **Proprietary (also in CMD):** Claude 5.x, GPT-6.x, Gemini 3.x/4, Grok 4.x. Use these only when open models score below 3 for a role.
