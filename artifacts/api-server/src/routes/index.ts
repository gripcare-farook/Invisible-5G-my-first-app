import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sheetsRouter from "./sheets";
import authRouter from "./auth";
import transportRouter from "./transport";
import adminRouter from "./admin";
import leadsRouter from "./leads";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sheetsRouter);
router.use(authRouter);
router.use(transportRouter);
router.use(adminRouter);
router.use(leadsRouter);
router.use(notificationsRouter);

export default router;
