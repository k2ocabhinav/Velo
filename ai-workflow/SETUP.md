# Orchestration Setup

Last updated: 2026-10-14

## Roles
- **Orchestrator: Claude Code (Opus 5.5).** Plans, splits work, writes tight task prompts, picks models from the scorecard, verifies results lightly (diff stat, a skim of key changes, one test run, spot-checking claims), integrates, commits when asked, and keeps the docs current.
- **Executor: CMD (Command Code CLI, `cmd`).** Does the heavy lifting: implementation, reviews, optimisation, bug hunts, test-fix loops and web research. Gives access to about 88 models (open-weight and proprietary), chosen per task with `-m`.
- **Principle:** the orchestrator spends tokens on judgement, and the executor spends them on volume.

## How CMD is driven
- **Headless call:** `cmd -p "<task>" --trust --skip-onboarding --max-turns N --output-format json -m <model> [--effort ...]`
- **Result:** the last NDJSON line is `{"type":"result", sessionId, usage, finalText}`. A follow-up uses `--session <id>`.
- **Read-only runs** (reviews, research) work anywhere, with no special flags.
- **Write and shell runs** need `--yolo` in headless mode. Policy: `--yolo` runs **only in an isolated git worktree**. Changes come back as a reviewed patch.
- **Parallel work:** several read-only reviewers can run at once on the main tree. Writers each get their own worktree.

## Instruction files
- `AGENTS.md` is the canonical rules file. CMD and other harnesses read it.
- `CLAUDE.md` imports it with `@AGENTS.md` and adds the orchestrator's notes.

## Tooling
| Tool | Status | Why |
|---|---|---|
| CMD (Command Code 1.81) | Used | Multi-model executor |
| Claude Code plugins: jdtls-lsp, typescript-lsp, frontend-design | Used | Code intelligence for Java and TS; UI quality |
| RuFlo / claude-flow v3 | Removed 2026-10-14 | Heavy swarm framework: hooks added noise to every prompt, set an AI co-author line on commits, and `init` overwrites instruction files |
| MemPalace | Not used in Velo | Disputed benchmarks; MCP and security rough edges |
| claude-mem | Not used | Subscription and crypto-token funnel; overlaps with git, the decision ledger and harness memory |
| Decision ledger (`docs/decisions/`, MADR-lite) | Used | Records why things were done, including mistakes |
