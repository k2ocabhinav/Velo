# Velo — Branching Strategy

> Rules for all agents. Read this before creating any branch.

## Branch Model

```
main (stable integration branch — always builds, always passes tests)
 ├── backend/<feature>     backend changes
 ├── frontend/<feature>    frontend changes
 └── security/<feature>    security fixes
```

## Rules

### 1. Branch Naming
```
<area>/<short-kebab-description>

Examples:
  backend/cors-config
  backend/refresh-tokens
  frontend/admin-dashboard-wiring
  frontend/rider-map-integration
  frontend/driver-app-mvp
  security/dependency-upgrades
```

### 2. Always Branch from `main`
```bash
git checkout main
git pull origin main
git checkout -b frontend/my-feature
```
Never branch from another feature branch.

### 3. Keep Branches Short-Lived
- One logical unit of work per branch
- Merge back to `main` when done and tests pass
- Delete the branch after merge

### 4. Before Merging to `main`
- Backend: `cd velo-platform && ./mvnw test` — all tests pass
- Frontend: `cd velo-frontend && npm run lint && npm run typecheck && npm run test:unit && npm run test:contracts && npm run build` — all pass
- No merge conflicts with `main`
- Update `docs/PROGRESS.md` — check off completed items

### 5. Merge Strategy
```bash
git checkout main
git merge <branch-name>
# or: git merge --squash <branch-name> (for cleaner history)
```
Prefer merge commit for large features (preserves history). Use squash for small fixes.

### 6. Commit Convention
```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, chore, perf, security
Scopes: admin, rider, driver, api, ui, ws, backend, ci

Examples:
  feat(rider): implement booking page with fare estimate
  fix(api): handle null response in unwrapper
  security(backend): pin log4j to patched version
  chore(ci): add staging deploy workflow
```

### 7. What Goes Where

| Change type | Branch prefix | Example |
|---|---|---|
| New backend endpoint | `backend/` | `backend/driver-location-api` |
| New frontend page/feature | `frontend/` | `frontend/rider-booking` |
| Shared package update | `frontend/` | `frontend/api-client-rides` |
| CI/CD changes | `frontend/` or `backend/` | `frontend/ci-quality-gates` |
| Security patches | `security/` | `security/dependency-upgrades` |
| Doc-only changes | commit directly to `main` | No branch needed |

### 8. Parallel Agent Work

Multiple agents can work simultaneously because frontend and backend live in separate directories:
- `velo-platform/` — backend (Java)
- `velo-frontend/` — frontend (TypeScript)

**No-conflict zones:**
- Two agents can work on `frontend/admin-X` and `frontend/rider-Y` simultaneously — they touch different app directories
- A backend agent and frontend agent can work simultaneously — different root directories
- Two agents should NOT work on the same shared package (`packages/api`, `packages/ui`) at the same time

**If conflict arises:**
1. The later agent rebases: `git rebase main`
2. Resolve conflicts
3. Re-run tests
4. Merge

### 9. Progress Tracking
After every merge to `main`, update `docs/PROGRESS.md`:
- Check off `[x]` items you completed
- Add new `[ ]` items you discovered
- Include your commit hash next to checked items
