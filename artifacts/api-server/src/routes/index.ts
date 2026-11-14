import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sheetsRouter from "./sheets";
import authRouter from "./auth";
import transportRouter from "./transport";
import adminRouter from "./admin";
import leadsRouter from "./leads";
import notificationsRouter from "./notifications";
import projectsRouter from "./projects";
import activityRouter from "./activity";
import ocrRouter from "./ocr";
import laptopRouter from '../laptop-watch/routes';
import { laptopBoundary } from '../laptop-watch/access';

const router: IRouter = Router();
router.use(laptopBoundary);
router.use('/laptop-watch',laptopRouter);

router.use(healthRouter);
router.use(sheetsRouter);
router.use(authRouter);
router.use(transportRouter);
router.use(adminRouter);
router.use(leadsRouter);
router.use(notificationsRouter);
router.use(projectsRouter);
router.use(activityRouter);
router.use(ocrRouter);

export default router;
