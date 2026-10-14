# Model Scorecard

Last updated: 2026-10-14. Evidence comes from `runs.jsonl`; see `README.md` for the protocol.
Score = mean `quality` for the role (n = number of rated runs). Untested = no evidence yet.

## Rankings by role
| Role | 1st | 2nd | Notes |
|---|---|---|---|
| review-backend | _pending: deepseek-v4-pro vs qwen3.8-max-0902_ | | head-to-head 2026-10-14 |
| review-security | _pending: glm-5.3 vs deepseek-v4.1-flash_ | | head-to-head 2026-10-14 |
| review-frontend | _pending: kimi-k3_ | | |
| test-ops | _pending: mimo-v2.6-pro_ | | |
| synthesis | untested (candidate: kimi-k3, 1M ctx) | | |
| research | deepseek-v4-flash (n=1, q=4) | | the default model; fine for web research |
| implement | untested | | |
| quick | deepseek-v4-flash / deepseek-v4.1-flash-fast | | cheapest |

## Model quirks (CMD flags)
| Model | Quirk |
|---|---|
| `qwen/*` (3.8-max-0902 confirmed) | `--effort` takes only `low`, `medium` or `xhigh`; `high` exits immediately |
| `xiaomi/mimo-v2.6-pro` | No `--effort` support: passing one exits immediately |
| deepseek / kimi / glm | `--effort high` accepted |
| any model, `-p` mode | Writes and shell need `--yolo` (worktree only, per the project's rules) |

## Catalog snapshot (2026-10-14, `cmd --list-models`, 88 models)
Open-weight coding candidates (newest per family):
- **DeepSeek:** v4-pro (reasoning), v4.1-flash (+vision), v4.1-flash-fast, v4-flash (CMD default). v4-flash is about $0.14/$0.28 per Mtok (web, mid-2026).
- **Qwen:** qwen3.8-max-0902 (strongest coding), qwen3.8-max, qwen3.8-flash (cheap), qwen3.8-27b. Fine for non-commercial use.
- **Kimi:** kimi-k3 (1M ctx, long-horizon), kimi-k2.7-code(-highspeed)
- **GLM:** zai-org/glm-5.3 (security-strong), z-ai/glm-5.3-flash (cheap, 1M ctx)
- **MiniMax:** minimax-m3. **MiMo:** mimo-v2.6-pro, mimo-v2.6-flash. **Others:** step-5-preview, longcat-2.0, mistral-large-4, nemotron-3-ultra
- **Free tiers:** poolside/laguna-s-2.1-free, inclusionai/ling-3.1-flash:free (try these for `quick`)
- **Proprietary (also in CMD):** Claude 5.x, GPT-6.x, Gemini 3.x/4, Grok 4.x. Use these only when open models score below 3 for a role.
