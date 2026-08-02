import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, installationsTable, projectsTable } from "@workspace/db";
import {
  ListInstallationsParams,
  ListInstallationsResponse,
  CreateInstallationParams,
  CreateInstallationBody,
  CreateInstallationResponse,
  UpdateInstallationParams,
  UpdateInstallationBody,
  UpdateInstallationResponse,
  DeleteInstallationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const RUN_KINDS = new Set(["cable", "tuberia"]);
const LAYER_KINDS: Record<string, Set<string>> = {
  electrica: new Set(["toma", "interruptor", "lampara", "tablero", "cable"]),
  agua: new Set(["llave", "ducha", "desague", "tanque", "tuberia"]),
};

/** Valida coherencia capa↔tipo y cantidad de puntos según el tipo. */
function installationShapeError(layer: string, kind: string, points: unknown[]): string | null {
  if (!LAYER_KINDS[layer]?.has(kind)) {
    return `El tipo "${kind}" no pertenece a la capa "${layer}"`;
  }
  if (RUN_KINDS.has(kind) && points.length < 2) {
    return "Un recorrido necesita al menos 2 puntos";
  }
  if (!RUN_KINDS.has(kind) && points.length !== 1) {
    return "Un símbolo debe tener exactamente 1 punto";
  }
  return null;
}

router.get("/projects/:id/installations", async (req, res): Promise<void> => {
  const params = ListInstallationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(installationsTable)
    .where(eq(installationsTable.projectId, params.data.id))
    .orderBy(installationsTable.id);
  res.json(ListInstallationsResponse.parse(rows));
});

router.post("/projects/:id/installations", async (req, res): Promise<void> => {
  const params = CreateInstallationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateInstallationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const shapeError = installationShapeError(
    parsed.data.layer,
    parsed.data.kind,
    parsed.data.points,
  );
  if (shapeError) {
    res.status(400).json({ error: shapeError });
    return;
  }
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }
  const [row] = await db
    .insert(installationsTable)
    .values({ ...parsed.data, projectId: params.data.id })
    .returning();
  res.status(201).json(CreateInstallationResponse.parse(row));
});

router.patch("/installations/:id", async (req, res): Promise<void> => {
  const params = UpdateInstallationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInstallationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.points) {
    const [existing] = await db
      .select()
      .from(installationsTable)
      .where(eq(installationsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Elemento no encontrado" });
      return;
    }
    const shapeError = installationShapeError(
      existing.layer,
      existing.kind,
      parsed.data.points,
    );
    if (shapeError) {
      res.status(400).json({ error: shapeError });
      return;
    }
  }
  const [row] = await db
    .update(installationsTable)
    .set(parsed.data)
    .where(eq(installationsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Elemento no encontrado" });
    return;
  }
  res.json(UpdateInstallationResponse.parse(row));
});

router.delete("/installations/:id", async (req, res): Promise<void> => {
  const params = DeleteInstallationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(installationsTable)
    .where(eq(installationsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Elemento no encontrado" });
    return;
  }
  res.sendStatus(204);
});

export default router;
