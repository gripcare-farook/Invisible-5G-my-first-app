import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sheetsRouter from "./sheets";
import authRouter from "./auth";
import transportRouter from "./transport";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sheetsRouter);
router.use(authRouter);
router.use(transportRouter);

export default router;
