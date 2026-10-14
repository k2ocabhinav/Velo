# Journal

Append-only. Newest at the bottom. Format: `- **YYYY-MM-DD** — what happened → consequence`.

## Before 2026-10-14 (reconstructed)
- **2026-04** — Backend, three portals and the landing site were built over about 84 commits with AI agents running under RuFlo/claude-flow v3 (swarm agents, hooks, memory). The agent files were kept out of git at the time.

## 2026-10-14 — Restart after a long pause
- **2026-10-14** — Work resumed. Claude Code became the orchestrator, and the CMD CLI was found and probed (`--help`, smoke tests) → headless mode can read but not write without `--yolo`; `accept-edits` and `--tools-enable` don't help → policy: `--yolo` only in worktrees.
- **2026-10-14** — CMD (deepseek-v4-flash) researched memory plugins, RuFlo and ADR practice → skipped MemPalace and claude-mem; adopted MADR-lite.
- **2026-10-14** — CMD restructured docs in a worktree: PROGRESS.md went from 375 to 98 lines, and 11 ADRs were backfilled. Verified by the orchestrator (open items 23/23 kept).
- **2026-10-14** — RuFlo was removed from the workspace. It had silently configured `Co-Authored-By: claude-flow` on commits, against the project's git rules.
- **2026-10-14** — First multi-model code review: 4 scopes, plus 2 head-to-heads (backend: deepseek-v4-pro vs qwen3.8-max-0902; security: glm-5.3 vs deepseek-v4.1-flash). Two runs died instantly on `--effort` flags (Qwen needs `xhigh`; MiMo accepts none) → recorded as model quirks in the scorecard.
- **2026-10-14** — Decided to track this AI-workflow material in the repo for later publication (ADR 0012).
