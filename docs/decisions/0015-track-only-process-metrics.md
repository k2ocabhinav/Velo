# 0015 — Track only process metrics; keep narratives local

- **Status:** Accepted
- **Date:** 2026-10-14
- **Supersedes:** 0012 (in part)

## Context

0012 put the whole AI-workflow folder in git, including the journal, lessons, plans and raw review reports. On reflection, the narrative material is personal working notes, and the review reports describe unfixed security weaknesses in detail. Neither should be in a repository that may become public.

## Options considered

1. **Keep everything tracked (0012 as is).** Pros: a complete record. Cons: exposes personal notes and vulnerability details.
2. **Track nothing.** Pros: private. Cons: loses the shareable, numeric model comparisons.
3. **Track only setup and metrics; ignore narratives.** Pros: the shareable numbers stay versioned, and private notes stay private. Cons: the narratives aren't backed up by git.

## Decision

Option 3. Tracked: `ai-workflow/README.md`, `SETUP.md`, `models/` (scorecard, run log, protocol). Gitignored: `JOURNAL.md`, `LESSONS.md`, `plans/`, `reviews/`.
The agent instruction files stay tracked, as 0012 decided.

## Consequences

- Run-log notes must stay short and factual. Detail belongs in the local journal.
- Local notes need their own backup if they matter.
- Those files remain in the history of the unpushed commits from 0012 until that history is rewritten.

## Related

- 0012
