import express from "express";
import uploadCourseThumbnail from "../middlewares/uploadCourseThumbnail.js";
import { requireAdmin } from "../middlewares/adminAuthMiddleware.js";
import {
  getAdminCourses,
  getPendingCourses,
  getAdminCourseSessions,
  getAdminCourseSessionsByQuery,
  getAdminCourseById,
  createAdminCourse,
  updateAdminCourse,
  approveCourse,
  rejectCourse,
  archiveCourse,
} from "../controllers/adminCourseController.js";

const router = express.Router();

router.use(requireAdmin); // Protect all routes

router.get("/", getAdminCourses);
router.get("/pending", getPendingCourses);
router.get("/sessions", getAdminCourseSessionsByQuery);
router.get("/:courseId/sessions", getAdminCourseSessions);
router.get("/:id", getAdminCourseById);
router.post("/", uploadCourseThumbnail.single("thumbnail"), createAdminCourse);
router.put("/:id", uploadCourseThumbnail.single("thumbnail"), updateAdminCourse);
router.patch("/:id/approve", approveCourse);
router.patch("/:id/reject", rejectCourse);
router.patch("/:id/archive", archiveCourse);

export default router;
