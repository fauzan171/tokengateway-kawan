# PROMPT-RUN — automated kawan-workspace execution

Copy-paste the prompt below into a fresh CC session (in the `tokengateway-kawan`
repo directory). The executing session acts as coordinator and delegates to
subagents. One prompt runs the whole DAG through WO-10 or blocked state.

---

Run the `docs/research-planning/kawan-workspace/` package to completion.

READ FIRST (mandatory order): `README.md`, `IMPLEMENTATION-PLAN.md` (DAG +
post-review decisions), `SDD-EXECUTION.md` (execution model), then the SDD
section for each WO you work on. The project CLAUDE.md rules apply in full.

MODE: `AUTO_PUSH=0` (local commit + merge only; do NOT push remote, do NOT touch
main, do NOT restart pm2). "Done" is proven only by gate evidence, never by
documents or self-report.

EXECUTION (you are the coordinator; do not write feature code yourself):

1. WO-0: commit the WP01/WP02 changes currently in the working tree + the entire
   `docs/research-planning/kawan-workspace/` package (two separate commits: feat
   WP01/WP02, docs package). Create the integration branch
   `feat/kawan-workspace` from that result.
2. For each WO in DAG order (IMPLEMENTATION-PLAN):
   a. Create worktree `worktrees/<wo-id>` + branch `wo/<id>` from
      `feat/kawan-workspace`.
   b. Spawn a worker subagent (`kawan-backend` for WO-B*, `kawan-frontend` for
      WO-F*) with a prompt scoped to that WO only (quote the relevant SDD
      section verbatim, give the worktree path, enforce "one WP per session",
      Indonesian for code comments/messages/UI strings).
   c. Spawn a test subagent: run the 4 gates in the worktree —
      `npx tsc --noEmit -p tsconfig.json`, `npx eslint <changed files>`,
      `npm test`, `npm run build` (plus `node scripts/check-migrations.mjs` and
      `npm run db:generate` for migration WOs). Save verbatim output to
      `GATE.md` in the worktree.
   d. Spawn a QA subagent `kawan-reviewer` (read-only): review the worktree diff
      against the SDD (contracts, security: key leakage/SSRF/taint/idempotency).
      S1/S2 findings go back to the worker (max 3 iterations; failing the 3rd →
      mark the WO blocked, continue with independent WOs).
   e. All green: auto-commit (`feat(wo): <id> <summary>` + gate evidence in the
      body) → squash-merge into `feat/kawan-workspace` → remove the worktree →
      update the status table in SDD-EXECUTION.md §5.
   f. Max 2 active worktrees in parallel. Critical-path priority: WO-0 → B1 →
      (B2∥B4∥B2b∥B2c) → B3 → (B5∥B2d) → (F2∥F5 after backend live; F1/F3/F4
      anytime after WO-0) → WO-9 → WO-10.
3. WO-9 e2e: an `observer` subagent runs Playwright (research.spec.ts +
   onboarding + file generation + SSE reconnect). Screenshots as evidence.
4. WO-10: final QA over the full `feat/kawan-workspace` branch + full 4 gates.
   Write `ACCEPTANCE.md` mapping every row of the IMPLEMENTATION-PLAN
   acceptance table to evidence (status: pass/blocked + reason).

FINAL REPORT: per-WO summary (status, iterations, evidence), blocked list with
causes, branch diffstat, and next steps for the owner (review + push/PR/deploy
decisions — NOT executed without the owner's explicit command).
