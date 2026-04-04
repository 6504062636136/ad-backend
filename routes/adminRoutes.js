import express from "express";
import { getDashboardStats, approveTeacher, rejectTeacher } from "../controllers/adminController.js";
import { requireAdmin } from "../middlewares/adminAuthMiddleware.js";

const router = express.Router();

router.use(requireAdmin); // Protect all routes with Admin requirement

router.get("/dashboard/summary", getDashboardStats);
router.patch("/users/:id/approve", approveTeacher);
router.patch("/users/:id/reject", rejectTeacher);

export default router;
