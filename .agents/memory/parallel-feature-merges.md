---
name: Parallel feature merges
description: How to resolve task rebases when main already has a parallel implementation of the same feature
---

Main can already contain a parallel implementation of the feature a task builds (another session merged first). Auto-merge then duplicates OpenAPI blocks/route registrations and can produce mangled route files.

**Why:** happened with the installations (eléctrica/agua) layers — main had a points-only model while the task used x/y + points + roomId; git silently kept both spec blocks and garbled the Express route.

**How to apply:** keep the task's data model end-to-end (it matches the already-pushed dev DB), delete the duplicate blocks in `lib/api-spec/openapi.yaml` and duplicate `router.use(...)` lines, re-run `pnpm --filter @workspace/api-spec codegen` instead of hand-merging generated files, port any genuine improvements from main's version (e.g. server-side validation), and remember `pnpm push` in lib/db if table shapes diverged.
