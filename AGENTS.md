# Velo Platform — Agent Instructions

## First Steps (MANDATORY)
1. Read `docs/README.md` (the index). It links to all docs.
2. Read `docs/BRANCHING.md` before creating any branch.
3. Read `docs/PROGRESS.md` to see what's done and what's not.
4. Read only the specific doc relevant to your task. Do NOT scan all source files.

## Documentation Rules (CRITICAL)
- **NEVER append "Implementation Status Update" blocks to any doc.** This bloats files and wastes tokens.
- Track progress ONLY in `docs/PROGRESS.md` — check off items, add new items.
- If you need to update a doc, edit the relevant section in place. Do not append at the bottom.
- Keep docs concise. If a doc exceeds 200 lines, you're probably adding too much.
- Living docs: when something changes, rewrite the affected text and delete what's obsolete. Git keeps the history.
- **Decision ledger** (`docs/decisions/`): record any choice that is costly to reverse, or that someone may later ask "why?" about, as a new `NNNN-title.md` from `0000-template.md`, and add it to the index. Records are append-only: to reverse one, write a new record that supersedes it. Mistakes are recorded, not erased.
- `docs/` is product documentation; keep it free of AI-tooling talk. The AI development process (orchestration, model scorecard, journal, lessons) lives in `ai-workflow/` and is tracked for later publication.

## Project Identity
- **Name:** Velo (white-label dispatch platform)
- **Package:** `com.velo.platform`
- **Maven:** `com.velo:velo-platform`
- **Backend dir:** `velo-platform/`
- **Frontend dir:** `velo-frontend/` (Turborepo monorepo)
- Domain models (Rider, Driver, Ride) are intentionally generic — do not rename

## Backend Conventions (MUST follow)
- Constructor injection via `@RequiredArgsConstructor` — never `@Autowired`
- `@Transactional` must be `org.springframework.transaction.annotation.Transactional` — NEVER `jakarta.transaction.Transactional`
- `@Transactional(readOnly = true)` on reads
- `GlobalResponseHandler` wraps all returns in `ApiResponse<>` — controllers return raw objects
- `@Tag` + `@Operation` + `@SecurityRequirement(name="bearerAuth")` on all secured endpoints
- `ResourceNotFoundException` (404), `RuntimeConflictException` (409) via `GlobalExceptionHandler`

## Frontend Conventions (MUST follow)
- Read `docs/DESIGN_SYSTEM.md` before touching UI code
- All components live in `packages/ui/` — apps import from packages, never the reverse
- Use semantic design tokens (never raw colors) — see `packages/ui/src/theme/tokens.css`
- Every data-fetching component must have a loading/skeleton state
- Auth via httpOnly cookies + BFF proxy routes — never localStorage for JWT

## Git Rules
- Read `docs/BRANCHING.md` for branch naming and merge rules
- After merging, update `docs/PROGRESS.md`
- Never add co-authored-by or AI attribution to commits
- Never reference AI tools in commit messages
- Commit convention: `<type>(<scope>): <description>`

## Multi-Model Orchestration
If you spawn sub-agents on other models, follow `ai-workflow/models/README.md`. Read `SCORECARD.md` before choosing a model. After each run, verify it, then rate and log it with `log-run.sh`. Add notable events to `ai-workflow/JOURNAL.md`.

## Available Skills
- `/cleanup-docs` — audit and trim `docs/` for token efficiency
