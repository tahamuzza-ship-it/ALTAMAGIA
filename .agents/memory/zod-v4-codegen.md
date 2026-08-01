---
name: Orval zod codegen import fix
description: Why the api-spec codegen script sed-rewrites the generated zod import
---

Rule: keep the `sed` step in `lib/api-spec/package.json` codegen that rewrites `from 'zod'` to `from 'zod/v4'` in `lib/api-zod/src/generated/api.ts`.

**Why:** Orval v8 emits Zod v4 syntax (`zod.int()`), but the installed zod 3.25.x only exposes the v4 API under the `zod/v4` subpath; without the rewrite `typecheck:libs` fails with TS2339 "Property 'int' does not exist".

**How to apply:** If codegen suddenly fails with `zod.int` type errors, check that the sed step is still in the codegen script (or that zod was not upgraded/changed).
