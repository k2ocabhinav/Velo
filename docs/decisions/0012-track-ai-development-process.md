# 0012 — Track the AI-assisted development process in the repository

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Velo is built mostly by AI coding agents. Until now, the agent instruction files (`AGENTS.md`, `CLAUDE.md`) and all agent tooling were gitignored, so nothing about *how* the project was built survived in the repository.
We now want to publish that process when the project is done: on GitHub and as a blog write-up covering the orchestration setup, how different (open-weight) models compared, and lessons learned. That needs a record kept continuously, not reconstructed at the end.

## Options considered

1. **Keep it all local and gitignored.** Pros: a clean repo. Cons: the data is lost or scattered, and the write-up would rely on memory.
2. **Mix process notes into `docs/`.** Pros: one place. Cons: muddles the product docs, which readers and agents load for building the product.
3. **A dedicated tracked folder, `ai-workflow/`, with agent instruction files tracked too.** Pros: complete, versioned history, ready to publish, and product docs stay focused. Cons: a slightly bigger repo; agent files become public with the repo.

## Decision

Option 3. Track `ai-workflow/` (setup, journal, lessons, model scorecard and run log, raw review reports) and stop ignoring `AGENTS.md` and `CLAUDE.md`.
Local tool state (`.claude/`, `.agents/`, caches, `settings.local.json`) stays ignored.

## Consequences

- Every orchestrator must keep `ai-workflow/` current: log runs, journal notable events, and distill lessons.
- `docs/` remains product documentation.
- Commit messages still don't reference AI tools (unchanged git rule).
- Risk: secrets or personal paths leaking into tracked agent files. Check before pushing.

## Related

- `ai-workflow/README.md`
- Supersedes the earlier unwritten convention of gitignoring agent files
