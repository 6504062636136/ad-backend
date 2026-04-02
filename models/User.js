import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      default: "",
    },
    lastName: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "student",
    },
    status: {
      type: String,
      enum: ["active", "pending", "inactive"],
      default: "active",
    },
    photoUrl: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);