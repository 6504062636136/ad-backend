import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    title: { type: String, default: "" },
    type: {
      type: String,
      enum: ["video", "pdf", "quiz", "text"],
      default: "video",
    },
    duration: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    content: { type: String, default: "" },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    thumbnailUrl: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFree: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "published", "archived"],
      default: "draft",
      index: true,
    },
    visibility: {
      type: String,
      enum: ["private", "public"],
      default: "private",
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    durationText: {
      type: String,
      default: "",
      trim: true,
    },
    maxStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    requirements: {
      type: [String],
      default: [],
    },
    objectives: {
      type: [String],
      default: [],
    },
    allowEnrollment: {
      type: Boolean,
      default: true,
    },
    hasCertificate: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    curriculum: {
      type: [sectionSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

courseSchema.index({ title: "text", category: "text", description: "text" });

const Course = mongoose.model("Course", courseSchema);

export default Course;