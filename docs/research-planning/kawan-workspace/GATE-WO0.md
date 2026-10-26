# GATE — WO-0

Basis: `027e17d4` (branch `feat/kawan-workspace` dibuat dari sini).
Dijalankan 26 Oktober 2026 di checkout utama, working tree = perubahan WP01/WP02.

## 1. `npx tsc --noEmit -p tsconfig.json`

```
$ npx tsc --noEmit -p tsconfig.json
$ echo $?
0
```
Output: kosong (tidak ada galat). Exit 0.

## 2. `npx eslint <19 file berubah + baru>`

```
$ npx eslint src/app/globals.css src/components/chat-view.tsx \
    src/components/task-view.test.tsx src/components/task-view.tsx \
    src/lib/chat/generate.ts src/lib/i18n/messages.ts \
    src/lib/tasks/run.test.ts src/lib/tasks/run.ts \
    src/lib/tasks/tasks.test.ts src/lib/tasks/tasks.ts \
    tests/worker-lifecycle.test.ts src/components/file-preview-drawer.tsx \
    src/components/file-preview-drawer.test.tsx \
    src/components/thinking-indicator.tsx \
    src/components/thinking-indicator.test.tsx \
    src/lib/engine/harness-bridge.ts src/lib/engine/harness-bridge.test.ts \
    e2e/research.spec.ts

/home/hermes/workspace/projects/tokengateway-kawan/src/app/globals.css
  0:0  warning  File ignored because no matching configuration was supplied

✖ 1 problem (0 errors, 1 warning)
```
Exit 0. Satu warning: `globals.css` di luar cakupan config eslint (CSS, bukan TS).

## 3. `npm test`

```
$ npm test
> vitest run
 RUN  v5.0.4 /home/hermes/workspace/projects/tokengateway-kawan

 Test Files  122 passed (122)
      Tests  1325 passed (1325)
   Start at  17:40:14
   Duration  315.39s
```
Exit 0. 0 gagal, 0 dilewati.

## 4. `npm run build`

```
$ npm run build
> next build
   ▲ Next.js 15.5.27
   - Environments: .env
   Creating an optimized production build ...
 ✓ Compiled successfully in 66s
   Linting and checking validity of types ...
   Collecting page data ...
```
Exit 0.

## Catatan

- `node_modules` tidak disentuh; `src/generated/prisma{,-sqlite}` adalah artefak
  generate (gitignored), dihasilkan ulang di tiap worktree lewat `npm run db:generate`.
- Baseline sebelum commit identik: tsc 0, eslint 0 error, test 1325 lulus.
