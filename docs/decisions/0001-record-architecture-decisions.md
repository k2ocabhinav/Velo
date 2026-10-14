# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Velo's long-lived choices—the data model, auth model, deployment target, cross-cutting conventions—were explained in passing or buried in prose docs, then lost. Settled questions got re-opened, and decisions were sometimes reversed without anyone knowing why they existed in the first place.

## Options considered

1. **Leave decisions in prose docs** — Pros: no new structure. Cons: rationale rots and gets overwritten by later edits.
2. **Leave decisions in commit messages only** — Pros: zero extra files. Cons: hard to discover, no index, no status.
3. **An append-only ledger of numbered records** — Pros: discoverable, chronological, records reversals honestly. Cons: requires discipline to write at decision time.

## Decision

We will keep an append-only decision ledger in `docs/decisions/`. Every choice that is costly to reverse, or that someone might later ask "why?", gets a numbered record started from `0000-template.md`. Records are never rewritten: a change is a new record that supersedes the old one rather than an edit to history.

## Consequences

- Settled questions have a citable answer, and reversals stay visible.
- Each decision costs a short written record at the time it is made.
- **Risks:** the ledger drifts if records are not written when decisions are actually made.

## Related

- Docs: [`README.md`](README.md), [`0000-template.md`](0000-template.md)
