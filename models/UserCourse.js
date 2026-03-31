import mongoose from "mongoose";

const userCourseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    progress: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastAccess: { type: Date, default: null },
  },
  { timestamps: true }
);

const UserCourse = mongoose.model("UserCourse", userCourseSchema);

export default UserCourse;