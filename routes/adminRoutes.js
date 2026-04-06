import express from "express";
import {
  getDashboardStats,
  getPendingTeachers,
  getAdminUsers,
  approveTeacher,
  rejectTeacher,
} from "../controllers/adminController.js";
import { getAdminSessions } from "../controllers/adminSessionController.js";
import { requireAdmin } from "../middlewares/adminAuthMiddleware.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/dashboard", getDashboardStats);
router.get("/dashboard/summary", getDashboardStats);

router.get("/users", getAdminUsers);
router.get("/users/pending", getPendingTeachers);
router.get("/teachers/pending", getPendingTeachers);
router.get("/session", getAdminSessions);
router.get("/sessions", getAdminSessions);

router.patch("/users/:id/approve", approveTeacher);
// Backward/alternative path used by some clients
router.patch("/users/:id/approval", approveTeacher);
router.patch("/users/:id/reject", rejectTeacher);

export default router;
