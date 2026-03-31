import express from "express";
import uploadCourseThumbnail from "../middlewares/uploadCourseThumbnail.js";
import {
  getAdminCourses,
  getAdminCourseById,
  createAdminCourse,
  updateAdminCourse,
  deleteAdminCourse,
} from "../controllers/adminCourseController.js";

const router = express.Router();

router.get("/", getAdminCourses);
router.get("/:id", getAdminCourseById);
router.post("/", uploadCourseThumbnail.single("thumbnail"), createAdminCourse);
router.put("/:id", uploadCourseThumbnail.single("thumbnail"), updateAdminCourse);
router.delete("/:id", deleteAdminCourse);

export default router;