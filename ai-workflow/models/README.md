# Model Scorecard System

The shared memory for any orchestrator (Claude Code, CMD, Codex, ...) that spawns sub-agents on different models.
Its job is to pick the right model for each job from evidence, not guesswork.

## Files
| File | What | Edit rule |
|---|---|---|
| `SCORECARD.md` | Current ranking per role, model quirks, and the catalog snapshot | Living doc: rewrite in place |
| `runs.jsonl` | One line per spawned run: tokens, time, outcome and the orchestrator's rating | Append-only (use `log-run.sh`) |
| `log-run.sh` | Pulls usage from a `cmd --output-format json` result and appends a rated line | — |

## Protocol (every orchestrator, every spawned run)
1. **Before spawning:** read `SCORECARD.md`, pick a model for the role, and respect the quirks (for example, effort flags).
   Refresh the catalog with `cmd --list-models` if the snapshot is more than 2 weeks old.
2. **After the run, verify before rating.** Spot-check at least 3 claims or findings against the code. Never rate on self-report.
3. **Log it** with `ai-workflow/models/log-run.sh <result.ndjson> <role> <model> <harness> <quality> <precision> "<notes>"`.
   - `quality` 1-5: 5 = correct, complete and on-format; 3 = useful but with gaps or noise; 1 = wrong or unusable.
   - `precision` 0-1: verified claims ÷ claims checked (`-` if not applicable).
   - Failures count too: a crash, a bad flag or a turn-cap hit is logged with quality 0.
4. **Update `SCORECARD.md`** when a run changes a ranking, reveals a quirk, or a head-to-head finishes.

## Roles
`review-backend`, `review-frontend`, `review-security`, `test-ops` (runs builds and tests), `implement`, `research`, `synthesis` (merges reports), `quick` (small, cheap lookups).

## Cost
CMD reports tokens but not prices. Use tokens and duration as the cost signal, and record known $/Mtok in the scorecard's catalog section.
Prefer the cheapest model whose score for the role is within 0.5 of the best.
