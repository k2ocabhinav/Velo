# AI Workflow: How Velo Is Built

A running record of how this project is built with AI coding agents: the orchestration setup, how different models perform, and what we learned.
It is kept current during development and will be published (GitHub plus a blog write-up) when the project is finished.

`docs/` is the product documentation. This folder is about the *process*.

| File | What | Edit rule |
|---|---|---|
| [SETUP.md](SETUP.md) | Current orchestration setup: harnesses, roles, policies, tools kept and removed | Living: rewrite in place |
| [JOURNAL.md](JOURNAL.md) | Dated log of notable events, decisions and surprises | Append-only, 1-3 lines per entry |
| [LESSONS.md](LESSONS.md) | Distilled, reusable lessons (the blog's backbone) | Living: merge and refine; delete what turns out wrong |
| [models/](models/README.md) | Model scorecard, run log, rating protocol | See `models/README.md` |
| [reviews/](reviews/) | Raw multi-model review reports, kept for model comparison | Add-only, one folder per review |

## Rules for anyone updating this folder
- Log every spawned sub-agent run in `models/runs.jsonl` (see the protocol).
- Add a `JOURNAL.md` entry when something notable happens: a new tool, a failure, a model surprise, or a process change.
- When a journal pattern repeats, distill it into `LESSONS.md`.
- Architecture and product decisions still go in `docs/decisions/`. Process decisions also go there when they're costly to reverse.
