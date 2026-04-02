import express from "express";
import admin from "../config/firebaseAdmin.js";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const router = express.Router();

// POST /admin/login
router.post("/login", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: "idToken is required",
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Email not found in Firebase token",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "ไม่พบบัญชีนี้ในฐานข้อมูล",
      });
    }

    if ((user.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({
        message: "บัญชีนี้ไม่ใช่ admin",
      });
    }

    if ((user.status || "").toLowerCase() !== "active") {
      return res.status(403).json({
        message: "บัญชีนี้ยังไม่พร้อมใช้งาน",
      });
    }

    return res.status(200).json({
      message: "Admin login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        photoUrl: user.photoUrl,
      },
    });
  } catch (error) {
    console.error("POST /admin/login error =", error);
    console.error("POST /admin/login message =", error?.message);

    return res.status(500).json({
      message: error?.message || "Admin login failed",
    });
  }
});

// GET /admin/me
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email?.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if ((user.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({
        message: "Access denied: admin only",
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        photoUrl: user.photoUrl,
      },
    });
  } catch (error) {
    console.error("GET /admin/me error =", error);
    console.error("GET /admin/me message =", error?.message);

    return res.status(500).json({
      message: error?.message || "Failed to fetch admin profile",
    });
  }
});

export default router;