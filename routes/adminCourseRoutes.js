import express from "express";
import uploadCourseThumbnail from "../middlewares/uploadCourseThumbnail.js";
import { requireAdmin } from "../middlewares/adminAuthMiddleware.js";
import {
  getAdminCourses,
  getAdminCourseById,
  createAdminCourse,
  updateAdminCourse,
  deleteAdminCourse,
  approveCourse,
  rejectCourse
} from "../controllers/adminCourseController.js";

const router = express.Router();

router.use(requireAdmin); // Protect all routes

router.get("/", getAdminCourses);
router.get("/:id", getAdminCourseById);
router.post("/", uploadCourseThumbnail.single("thumbnail"), createAdminCourse);
router.put("/:id", uploadCourseThumbnail.single("thumbnail"), updateAdminCourse);
router.delete("/:id", deleteAdminCourse);

router.patch("/:id/approve", approveCourse);
router.patch("/:id/reject", rejectCourse);

export default router;