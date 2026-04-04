import admin from "../config/firebaseAdmin.js";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Use Prisma to check if user is admin
export const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "unauthorized - No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email?.trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ success: false, message: "unauthorized - Invalid token identity" });
    }

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: "unauthorized - User not found in database" });
    }

    if ((user.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, message: "forbidden - Access denied: Admin only" });
    }

    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error("adminAuth error:", error);
    return res.status(401).json({ success: false, message: "unauthorized - Invalid or expired token" });
  }
};
