@AGENTS.md

# Claude Code: Orchestration (process docs live in `ai-workflow/`)

Claude Code plans, delegates, does a light verification, and integrates. CMD (`cmd`, Command Code) is the secondary agent that does the heavy lifting.

- **Delegate to CMD:** implementation, code reviews, optimisation, bug investigation, test-fix loops, web research.
- **Claude keeps:** planning, writing tight task prompts, `git diff --stat` plus a skim of key changes, one test or build run, and decisions for the ledger.
- **CMD read-only (anywhere):** `cmd -p "<task>" --trust --skip-onboarding --no-session --max-turns N --output-format json`, then read the result with `tail -1 | jq -r .finalText`.
- **CMD writes:** `--yolo` ONLY inside a git worktree (`git worktree add <scratch>/wt-x -b <branch> main`), never in this tree. Bring changes back with a reviewed patch. No commits unless the user asks.
- **Codex (second executor):** `codex exec --ignore-user-config -m gpt-6-luna -c model_reasoning_effort=xhigh -s workspace-write -C <worktree> --json -o last.md "<task>" < /dev/null`. Use only gpt-6-luna (xhigh) or gpt-6.1-sol; never gpt-6-astra or older models. Details are in `ai-workflow/SETUP.md`.
- **Follow-ups:** `--session <sessionId>` taken from the result line.
- **Tooling:** No orchestration framework. RuFlo/claude-flow was removed on 2026-10-14; the backup is at `~/Projects/velo-tooling-backup-2026-10-14.tar.gz`. Project plugins: jdtls-lsp, typescript-lsp, frontend-design. The only skill is `cleanup-docs`.
- **Memory:** cross-session facts go in Claude auto-memory. Project decisions go in `docs/decisions/`, and progress in `docs/PROGRESS.md`.
