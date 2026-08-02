import { Router, type IRouter } from "express";
import planbRouter from "./planb";
import healthRouter from "./health";
import projectsRouter from "./projects";
import materialsRouter from "./materials";
import dashboardRouter from "./dashboard";
import installationsRouter from "./installations";

const router: IRouter = Router();

// Plan B se monta primero: la cabina tiene su propia autenticación
router.use(planbRouter);
router.use(healthRouter);
router.use(projectsRouter);
router.use(materialsRouter);
router.use(dashboardRouter);
router.use(installationsRouter);

export default router;
