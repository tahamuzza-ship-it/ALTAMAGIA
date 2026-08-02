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
