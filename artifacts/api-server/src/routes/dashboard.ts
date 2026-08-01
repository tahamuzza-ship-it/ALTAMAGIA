import { Router, type IRouter } from "express";
import { db, projectsTable, roomsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);
  const rooms = await db.select().from(roomsTable);

  const totalFloorAreaM2 =
    Math.round(
      rooms.reduce((sum, r) => sum + r.widthM * r.lengthM, 0) * 100,
    ) / 100;

  const statusCounts = new Map<string, number>();
  for (const p of projects) {
    statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  }

  res.json(
    GetDashboardSummaryResponse.parse({
      totalProjects: projects.length,
      totalRooms: rooms.length,
      totalFloorAreaM2,
      byStatus: [...statusCounts.entries()].map(([status, count]) => ({
        status,
        count,
      })),
    }),
  );
});

export default router;
