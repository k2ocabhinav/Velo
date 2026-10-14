# Lessons Learned

Living list, refined as evidence grows. Each lesson: the claim, then the evidence (journal date or run).

## Orchestration
- **Split judgement from volume.** The orchestrator plans and verifies; a cheaper executor does the reading and writing. *Evidence: 2026-10-14 docs restructure and review fan-out.*
- **Never trust self-reports; spot-check.** Cheap checks (counting items, grepping for forbidden terms, `git status`) catch most problems. *Evidence: 2026-10-14 docs restructure check.*
- **Isolate any agent that writes.** Headless agents need full-permission mode to write; a worktree makes that safe. *Evidence: 2026-10-14 CMD probe.*
- **Budget fan-outs against the executor's quota.** Parallel full-repo reviewers each re-read the codebase, so the cost scales with the number of agents. Six agents exhausted a 5-hour plan window in 8 minutes. Prefer 2-3 reviewers, narrower scopes, or staggered starts. *Evidence: 2026-10-14 quota hit.*

## Tooling
- **Heavy agent frameworks carry hidden side effects.** RuFlo injected text into every prompt and set an AI co-author line on commits. Audit any framework's settings after installing it. *Evidence: 2026-10-14 cleanup.*
- **Check model flags per model.** Effort levels differ between providers, and a wrong flag fails instantly. Keep a quirks table. *Evidence: 2026-10-14 Qwen/MiMo failures.*

## Models
- **Cheap "flash" models can review as well as pro tiers.** deepseek-v4.1-flash produced an OWASP-tagged security review with the same precision as deepseek-v4-pro's backend review. *Evidence: runs.jsonl 2026-10-14.*
- **Token appetite varies widely on the same task.** glm-5.3 consumed 1.5x more input than deepseek-v4.1-flash on an identical security scope and still hadn't finished. *Evidence: runs.jsonl 2026-10-14.*
- **Independent reviewers share false positives.** Two different models made the same wrong claim (a missing unique constraint), so agreement between models is not verification. *Evidence: 2026-10-14 spot-checks.*
