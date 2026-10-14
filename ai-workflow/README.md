# AI Workflow: How Velo Is Built

How this project is built with AI coding agents: the orchestration setup and measured model performance.
Only metrics and setup are tracked in git. Narrative notes stay local (see decision 0015).

| File | What | Tracked |
|---|---|---|
| [SETUP.md](SETUP.md) | Orchestration setup: harnesses, roles, policies, tools | Yes (living) |
| [models/](models/README.md) | Model scorecard, run log (tokens, time, ratings), rating protocol | Yes |
| `JOURNAL.md` | Dated log of events and surprises | No (local only) |
| `LESSONS.md` | Distilled lessons learned | No (local only) |
| `plans/`, `reviews/` | Implementation plans and raw review reports | No (local only) |

## Rules
- Log every spawned sub-agent run in `models/runs.jsonl` (see the protocol). Keep notes to one short line.
- Notable events go in the local `JOURNAL.md`; repeated patterns get distilled into the local `LESSONS.md`.
- Architecture and product decisions go in `docs/decisions/`.
