import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import coachRouter from "./coach";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(coachRouter);

export default router;
