import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, materialsTable } from "@workspace/db";
import {
  ListMaterialsResponse,
  CreateMaterialBody,
  CreateMaterialResponse,
  UpdateMaterialParams,
  UpdateMaterialBody,
  UpdateMaterialResponse,
  DeleteMaterialParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/materials", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(materialsTable)
    .orderBy(materialsTable.category, materialsTable.name);
  res.json(ListMaterialsResponse.parse(rows));
});

router.post("/materials", async (req, res): Promise<void> => {
  const parsed = CreateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(materialsTable).values(parsed.data).returning();
  res.status(201).json(CreateMaterialResponse.parse(row));
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const params = UpdateMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(materialsTable)
    .set(parsed.data)
    .where(eq(materialsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Material no encontrado" });
    return;
  }
  res.json(UpdateMaterialResponse.parse(row));
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  const params = DeleteMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(materialsTable)
    .where(eq(materialsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Material no encontrado" });
    return;
  }
  res.sendStatus(204);
});

export default router;
