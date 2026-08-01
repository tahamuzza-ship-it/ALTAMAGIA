# BioCasa

App personal (en español) para diseñar casas de bioconstrucción: proyectos con espacios/planos 2D, cálculo automático de materiales (guadua, tierra, arena, etc.) y cotización en COP con catálogo de precios propio.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/bioconstruccion` (react-vite, wouter; pages: `/`, `/proyectos/:id`, `/materiales`)
- API routes: `artifacts/api-server/src/routes/{projects,materials,dashboard}.ts`
- Estimate logic (factores de materiales por sistema constructivo): `artifacts/api-server/src/lib/estimate.ts`
- DB schema: `lib/db/src/schema/{projects,rooms,materials}.ts`
- API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- Estimates are computed server-side (`GET /projects/{id}/estimate`) from rooms + wallSystem + roofType, priced by matching material name (case-insensitive) against the catalog; unmatched items return `priced: false`.
- Material quantity factors are rough anteproyecto approximations, not structural design.
- Codegen script rewrites the generated zod import to `zod/v4` (orval emits v4 syntax but imports the v3 entrypoint of zod 3.25.x).

## Product

- Dashboard de proyectos con estadísticas; detalle de proyecto con plano 2D interactivo (SVG a escala), lista de espacios y cotización de materiales agrupada por categoría; catálogo CRUD de materiales con precios en COP.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
