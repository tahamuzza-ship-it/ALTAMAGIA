import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, roomsTable, materialsTable } from "@workspace/db";
import {
  ListProjectsResponse,
  CreateProjectBody,
  CreateProjectResponse,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  ListRoomsParams,
  ListRoomsResponse,
  CreateRoomParams,
  CreateRoomBody,
  CreateRoomResponse,
  UpdateRoomParams,
  UpdateRoomBody,
  UpdateRoomResponse,
  DeleteRoomParams,
  GetProjectEstimateParams,
  GetProjectEstimateResponse,
} from "@workspace/api-zod";
import { computeAreas, computeItems } from "../lib/estimate";

const router: IRouter = Router();

const serializeProject = (p: typeof projectsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
});

router.get("/projects", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.createdAt);
  res.json(ListProjectsResponse.parse(rows.map(serializeProject)));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json(CreateProjectResponse.parse(serializeProject(row!)));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }
  res.json(GetProjectResponse.parse(serializeProject(row)));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }
  res.json(UpdateProjectResponse.parse(serializeProject(row)));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }
  res.sendStatus(204);
});

router.get("/projects/:id/rooms", async (req, res): Promise<void> => {
  const params = ListRoomsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.projectId, params.data.id))
    .orderBy(roomsTable.id);
  res.json(ListRoomsResponse.parse(rows));
});

router.post("/projects/:id/rooms", async (req, res): Promise<void> => {
  const params = CreateRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateRoomBody.safeParse(req.body);
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
    .insert(roomsTable)
    .values({ ...parsed.data, projectId: params.data.id })
    .returning();
  res.status(201).json(CreateRoomResponse.parse(row));
});

router.patch("/rooms/:id", async (req, res): Promise<void> => {
  const params = UpdateRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(roomsTable)
    .set(parsed.data)
    .where(eq(roomsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Espacio no encontrado" });
    return;
  }
  res.json(UpdateRoomResponse.parse(row));
});

router.delete("/rooms/:id", async (req, res): Promise<void> => {
  const params = DeleteRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(roomsTable)
    .where(eq(roomsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Espacio no encontrado" });
    return;
  }
  res.sendStatus(204);
});

router.get("/projects/:id/estimate", async (req, res): Promise<void> => {
  const params = GetProjectEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }
  const rooms = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.projectId, params.data.id));
  const materials = await db.select().from(materialsTable);
  const priceByName = new Map(
    materials.map((m) => [m.name.trim().toLowerCase(), m]),
  );

  const areas = computeAreas(rooms);
  const raw = computeItems(project.wallSystem, project.roofType, areas);
  const items = raw.map((item) => {
    const material = priceByName.get(item.materialName.trim().toLowerCase());
    const unitPrice = material?.unitPrice ?? 0;
    const subtotal = Math.round(item.quantity * unitPrice);
    return {
      ...item,
      unitPrice,
      subtotal,
      priced: material != null,
    };
  });
  const totalCost = items.reduce((sum, item) => sum + item.subtotal, 0);

  res.json(
    GetProjectEstimateResponse.parse({
      projectId: project.id,
      ...areas,
      items,
      totalCost,
    }),
  );
});

export default router;
