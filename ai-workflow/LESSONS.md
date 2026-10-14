# Lessons Learned

Living list, refined as evidence grows. Each lesson: the claim, then the evidence (journal date or run).

## Orchestration
- **Split judgement from volume.** The orchestrator plans and verifies; a cheaper executor does the reading and writing. *Evidence: 2026-10-14 docs restructure and review fan-out.*
- **Never trust self-reports; spot-check.** Cheap checks (counting items, grepping for forbidden terms, `git status`) catch most problems. *Evidence: 2026-10-14 docs restructure check.*
- **Isolate any agent that writes.** Headless agents need full-permission mode to write; a worktree makes that safe. *Evidence: 2026-10-14 CMD probe.*

## Tooling
- **Heavy agent frameworks carry hidden side effects.** RuFlo injected text into every prompt and set an AI co-author line on commits. Audit any framework's settings after installing it. *Evidence: 2026-10-14 cleanup.*
- **Check model flags per model.** Effort levels differ between providers, and a wrong flag fails instantly. Keep a quirks table. *Evidence: 2026-10-14 Qwen/MiMo failures.*

## Models
- _Pending: results of the 2026-10-14 head-to-head reviews._
