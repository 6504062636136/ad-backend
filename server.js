import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import pkg from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import admin from "./config/firebaseAdmin.js";

import adminCourseRoutes from "./routes/adminCourseRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { requireAdmin } from "./middlewares/adminAuthMiddleware.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const safeDeleteFile = (fileUrl) => {
  if (!fileUrl) return;
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return;

  const normalized = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
  const filePath = path.join(__dirname, normalized);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const getUploadFolder = (role, fieldname) => {
  if (role === "student") {
    if (fieldname === "photo") {
      return path.join(__dirname, "uploads", "students", "photos");
    }
    return path.join(__dirname, "uploads", "students", "documents");
  }

  if (fieldname === "photo") {
    return path.join(__dirname, "uploads", "teachers", "photos");
  }

  return path.join(__dirname, "uploads", "teachers", "documents");
};

const getFileUrlByRole = (role, fieldname, filename) => {
  if (!filename) return null;

  if (role === "student") {
    if (fieldname === "photo") {
      return `/uploads/students/photos/${filename}`;
    }
    return `/uploads/students/documents/${filename}`;
  }

  if (fieldname === "photo") {
    return `/uploads/teachers/photos/${filename}`;
  }

  return `/uploads/teachers/documents/${filename}`;
};

ensureDir(path.join(__dirname, "uploads", "teachers", "photos"));
ensureDir(path.join(__dirname, "uploads", "teachers", "documents"));
ensureDir(path.join(__dirname, "uploads", "students", "photos"));
ensureDir(path.join(__dirname, "uploads", "students", "documents"));
ensureDir(path.join(__dirname, "uploads", "courses"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const role = req.body.role || "teacher";
    const folder = getUploadFolder(role, file.fieldname);
    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${safeName}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const imageTypes = ["image/png", "image/jpeg", "image/jpg"];
  const pdfTypes = ["application/pdf"];
  const pdfOrImageTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];

  if (file.fieldname === "photo") {
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Photo must be PNG, JPG, or JPEG"));
    }
    return;
  }

  if (
    file.fieldname === "degreeCertificate" ||
    file.fieldname === "teachingLicense" ||
    file.fieldname === "transcript"
  ) {
    if (pdfTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Document must be PDF"));
    }
    return;
  }

  if (file.fieldname === "studentCard") {
    if (pdfOrImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Student card must be PDF, PNG, JPG, or JPEG"));
    }
    return;
  }

  cb(new Error("Unexpected file field"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/api/test-server", (req, res) => {
  res.json({ message: "backend updated OK" });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { role, search = "", status } = req.query;

    const where = {};

    if (role && role.trim() !== "") {
      where.role = role.trim().toLowerCase();
    }

    if (status && status.trim() !== "") {
      where.status = { equals: status.trim(), mode: "insensitive" };
    }

    if (search && search.trim() !== "") {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { schoolName: { contains: search, mode: "insensitive" } },
        { gradeLevel: { contains: search, mode: "insensitive" } },
        { parentName: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
    });

    const mappedUsers = users.map(u => ({
         ...u,
         name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()
    }));

    res.json({
      success: true,
      message: "ดึงรายการผู้ใช้สำเร็จ",
      data: mappedUsers
    });
  } catch (error) {
    console.error("GET /api/admin/users error full =", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message });
  }
});

app.get("/api/admin/users/stats", async (req, res) => {
  try {
    const { role } = req.query;

    const baseWhere = role ? { role } : {};

    const total = await prisma.user.count({ where: baseWhere });
    const active = await prisma.user.count({
      where: { ...baseWhere, status: "Active" },
    });
    const pending = await prisma.user.count({
      where: { ...baseWhere, status: "Pending" },
    });
    const inactive = await prisma.user.count({
      where: { ...baseWhere, status: "Inactive" },
    });

    res.json({
      total,
      active,
      pending,
      inactive,
    });
  } catch (error) {
    console.error("GET /api/admin/users/stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้ที่ต้องการแก้ไข",
      });
    }

    const responseUser = {
      ...user,
      name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    };

    res.json({ success: true, message: "ดึงผู้ใช้สำเร็จ", data: responseUser });
  } catch (error) {
    console.error("GET /api/admin/users/:id error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message });
  }
});

app.post(
  "/api/admin/users",
  requireAdmin,
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
    { name: "teachingLicense", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
    { name: "studentCard", maxCount: 1 },
  ]),
  async (req, res) => {
    let firebaseUser = null;

    try {
      const {
        firstName,
        lastName,
        name,
        email,
        password,
        phone,
        address,
        dateOfBirth,
        placeOfBirth,
        subject,
        degree,
        university,
        city,
        startEndDate,
        schoolName,
        gradeLevel,
        program,
        parentName,
        parentPhone,
        role,
        status,
      } = req.body;

      const normalizedEmail = (email || "").trim().toLowerCase();
      const normalizedRole = (role || "teacher").trim().toLowerCase();
      const normalizedStatus = status || "Active";
      const displayName =
        name || `${firstName || ""} ${lastName || ""}`.trim();

      const photoFile = req.files?.photo?.[0];
      const degreeCertificateFile = req.files?.degreeCertificate?.[0];
      const teachingLicenseFile = req.files?.teachingLicense?.[0];
      const transcriptFile = req.files?.transcript?.[0];
      const studentCardFile = req.files?.studentCard?.[0];

      if (!normalizedEmail) {
        return res.status(400).json({
          error: "กรุณากรอกอีเมล",
        });
      }

      if (!password || password.trim().length < 6) {
        return res.status(400).json({
          error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        });
      }

      const existingUser = await prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return res.status(400).json({
          error: `อีเมลนี้มีอยู่แล้วในระบบ: ${normalizedEmail}`,
        });
      }

      try {
        const existingFirebaseUser = await admin
          .auth()
          .getUserByEmail(normalizedEmail);

        if (existingFirebaseUser) {
          return res.status(400).json({
            error: `อีเมลนี้มีอยู่แล้วใน Firebase: ${normalizedEmail}`,
          });
        }
      } catch (firebaseLookupError) {
        if (firebaseLookupError.code !== "auth/user-not-found") {
          throw firebaseLookupError;
        }
      }

      firebaseUser = await admin.auth().createUser({
        email: normalizedEmail,
        password: password.trim(),
        displayName: displayName || normalizedEmail,
        disabled: normalizedStatus === "Inactive",
      });

      const user = await prisma.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          firstName,
          lastName,
          name: displayName,
          email: normalizedEmail,

          // ใช้ Firebase Auth เป็นระบบล็อกอินหลัก
          password: null,

          phone,
          address,
          dateOfBirth,
          placeOfBirth,
          role: normalizedRole,
          status: normalizedStatus,

          subject: subject || null,
          degree: degree || null,
          university: university || null,
          city: city || null,
          startEndDate: startEndDate || null,

          schoolName: schoolName || null,
          gradeLevel: gradeLevel || null,
          program: program || null,
          parentName: parentName || null,
          parentPhone: parentPhone || null,

          photoUrl: photoFile
            ? getFileUrlByRole(normalizedRole, "photo", photoFile.filename)
            : null,
          degreeCertificateUrl: degreeCertificateFile
            ? getFileUrlByRole(
              normalizedRole,
              "degreeCertificate",
              degreeCertificateFile.filename
            )
            : null,
          teachingLicenseUrl: teachingLicenseFile
            ? getFileUrlByRole(
              normalizedRole,
              "teachingLicense",
              teachingLicenseFile.filename
            )
            : null,
          transcriptUrl: transcriptFile
            ? getFileUrlByRole(
              normalizedRole,
              "transcript",
              transcriptFile.filename
            )
            : null,
          studentCardUrl: studentCardFile
            ? getFileUrlByRole(
              normalizedRole,
              "studentCard",
              studentCardFile.filename
            )
            : null,
        },
      });

      return res.status(200).json({ success: true, message: "สร้างผู้ใช้สำเร็จ", data: user });
    } catch (error) {
      console.error("POST /api/admin/users error:", error);
      console.error("POST /api/admin/users message:", error?.message);
      console.error("POST /api/admin/users code:", error?.code);

      if (firebaseUser?.uid) {
        try {
          await admin.auth().deleteUser(firebaseUser.uid);
        } catch (rollbackError) {
          console.error("Firebase rollback error:", rollbackError);
        }
      }

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น",
        });
      }

      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({
          success: false,
          message: "อีเมลนี้มีอยู่ใน Firebase แล้ว กรุณาใช้อีเมลอื่น",
        });
      }

      if (error.code === "auth/invalid-password") {
        return res.status(400).json({
          success: false,
          message: "รหัสผ่านไม่ถูกต้องตามเงื่อนไขของ Firebase",
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || "สร้างผู้ใช้ไม่สำเร็จ",
      });
    }
  }
);

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้ที่ต้องการลบ" });
    }

    safeDeleteFile(existingUser.photoUrl);
    safeDeleteFile(existingUser.degreeCertificateUrl);
    safeDeleteFile(existingUser.teachingLicenseUrl);
    safeDeleteFile(existingUser.transcriptUrl);
    safeDeleteFile(existingUser.studentCardUrl);

    await prisma.user.delete({
      where: { id },
    });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/admin/users/:id error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message });
  }
});

app.put(
  "/api/admin/users/:id",
  requireAdmin,
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
    { name: "teachingLicense", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
    { name: "studentCard", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return res.status(404).json({
          error: "ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข",
        });
      }

      const {
        firstName,
        lastName,
        name,
        email,
        password,
        phone,
        address,
        dateOfBirth,
        placeOfBirth,
        subject,
        degree,
        university,
        city,
        startEndDate,
        schoolName,
        gradeLevel,
        program,
        parentName,
        parentPhone,
        role,
        status,
      } = req.body;

      const normalizedRole = (role || existingUser.role || "teacher").trim().toLowerCase();

      if (email && email !== existingUser.email) {
        const duplicateUser = await prisma.user.findFirst({
          where: { email },
        });

        if (duplicateUser) {
          return res.status(400).json({
            error: `อีเมลนี้มีอยู่แล้วในระบบ: ${email}`,
          });
        }
      }

      const photoFile = req.files?.photo?.[0];
      const degreeCertificateFile = req.files?.degreeCertificate?.[0];
      const teachingLicenseFile = req.files?.teachingLicense?.[0];
      const transcriptFile = req.files?.transcript?.[0];
      const studentCardFile = req.files?.studentCard?.[0];

      if (photoFile && existingUser.photoUrl) {
        safeDeleteFile(existingUser.photoUrl);
      }
      if (degreeCertificateFile && existingUser.degreeCertificateUrl) {
        safeDeleteFile(existingUser.degreeCertificateUrl);
      }
      if (teachingLicenseFile && existingUser.teachingLicenseUrl) {
        safeDeleteFile(existingUser.teachingLicenseUrl);
      }
      if (transcriptFile && existingUser.transcriptUrl) {
        safeDeleteFile(existingUser.transcriptUrl);
      }
      if (studentCardFile && existingUser.studentCardUrl) {
        safeDeleteFile(existingUser.studentCardUrl);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          firstName,
          lastName,
          name: name || `${firstName || ""} ${lastName || ""}`.trim(),
          email,
          password:
            password && password.trim() !== ""
              ? password
              : existingUser.password,
          phone,
          address,
          dateOfBirth,
          placeOfBirth,
          role: normalizedRole,
          status,

          subject: subject || null,
          degree: degree || null,
          university: university || null,
          city: city || null,
          startEndDate: startEndDate || null,

          schoolName: schoolName || null,
          gradeLevel: gradeLevel || null,
          program: program || null,
          parentName: parentName || null,
          parentPhone: parentPhone || null,

          photoUrl: photoFile
            ? getFileUrlByRole(normalizedRole, "photo", photoFile.filename)
            : existingUser.photoUrl,
          degreeCertificateUrl: degreeCertificateFile
            ? getFileUrlByRole(
              normalizedRole,
              "degreeCertificate",
              degreeCertificateFile.filename
            )
            : existingUser.degreeCertificateUrl,
          teachingLicenseUrl: teachingLicenseFile
            ? getFileUrlByRole(
              normalizedRole,
              "teachingLicense",
              teachingLicenseFile.filename
            )
            : existingUser.teachingLicenseUrl,
          transcriptUrl: transcriptFile
            ? getFileUrlByRole(normalizedRole, "transcript", transcriptFile.filename)
            : existingUser.transcriptUrl,
          studentCardUrl: studentCardFile
            ? getFileUrlByRole(normalizedRole, "studentCard", studentCardFile.filename)
            : existingUser.studentCardUrl,
        },
      });

      res.json({ success: true, message: "อัปเดตผู้ใช้สำเร็จ", data: updatedUser });
    } catch (error) {
      console.error("PUT /api/admin/users/:id error:", error);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error: error.message });
    }
  }
);

app.use("/api/admin/courses", adminCourseRoutes);
const normalizeCourseId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
};

const mapSessionDoc = (doc) => {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc?._id?.$oid || String(doc?._id || ""),
    id: doc?.id || doc?._id?.$oid || String(doc?._id || ""),
  };
};

app.get("/api/admin/session", requireAdmin, async (req, res) => {
  try {
    const courseId = normalizeCourseId(req.query?.courseId || "");

    if (!courseId) {
      return res.json([]);
    }

    const filters = [{ courseId }];

    if (/^[a-fA-F0-9]{24}$/.test(courseId)) {
      filters.push({ courseId: { $oid: courseId } });
    }

    const result = await prisma.$runCommandRaw({
      find: "sessions",
      filter: { $or: filters },
    });

    const docs = result?.cursor?.firstBatch || [];

    // 🔥 ดึง teacherId ทั้งหมด
    const teacherIds = [
      ...new Set(
        docs
          .map((s) => s?.teacherId?.$oid || s?.teacherId || "")
          .filter(Boolean)
          .map(String)
      ),
    ];

    // 🔥 ไป query user
    const teachers = teacherIds.length
      ? await prisma.user.findMany({
          where: { id: { in: teacherIds } },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        })
      : [];

    const teacherMap = new Map(
      teachers.map((t) => [
        t.id,
        t.name ||
          `${t.firstName || ""} ${t.lastName || ""}`.trim() ||
          t.email ||
          "-",
      ])
    );

    // 🔥 map session
    const sessions = docs.map((s) => {
      const instructorId = String(
        s?.teacherId?.$oid || s?.teacherId || ""
      );

      return {
        _id: s?._id?.$oid || String(s?._id || ""),
        id: s?.id || s?._id?.$oid || String(s?._id || ""),
        startDate: s?.date || "",
        endDate: s?.date || "",
        startTime: s?.startTime || "",
        endTime: s?.endTime || "",
        meetingLink: s?.meetLink || "",
        capacity: s?.maxSeats || "",
        instructorId,
        instructorName: teacherMap.get(instructorId) || "-", // 🔥 FIX ตรงนี้
        status: s?.status || "open",
        bookedSeats: s?.bookedSeats || 0,
      };
    });

    return res.json(sessions);
  } catch (error) {
    console.error("GET /api/admin/session error:", error);
    return res.status(500).json({
      success: false,
      message: "failed to load sessions",
      error: error.message,
    });
  }
});

app.post("/api/admin/session", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const courseId = normalizeCourseId(
      body.courseId || body.course_id || body.course || ""
    );

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "missing courseId",
      });
    }

    const id = String(body.id || "").trim() || crypto.randomUUID();
    const now = new Date();

    await prisma.$runCommandRaw({
      insert: "sessions",
      documents: [
        {
          ...body,
          id,
          courseId,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const found = await prisma.$runCommandRaw({
      find: "sessions",
      filter: { id },
      limit: 1,
    });

    const doc = found?.cursor?.firstBatch?.[0] || null;

    return res.json({
      success: true,
      message: "session saved",
      data: doc ? mapSessionDoc(doc) : { id, courseId },
    });
  } catch (error) {
    console.error("POST /api/admin/session error:", error);
    return res.status(500).json({
      success: false,
      message: "failed to save session",
      error: error.message,
    });
  }
});

app.put("/api/admin/session/:sessionId", requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const body = req.body || {};
    const courseId = normalizeCourseId(
      body.courseId || body.course_id || body.course || ""
    );
    const now = new Date();

    const updateDoc = {
      ...body,
      updatedAt: now,
    };

    if (courseId) {
      updateDoc.courseId = courseId;
    }

    const byId = await prisma.$runCommandRaw({
      update: "sessions",
      updates: [
        {
          q: { id: sessionId },
          u: { $set: updateDoc },
          upsert: false,
          multi: false,
        },
      ],
    });

    const matchedById = Number(byId?.n || byId?.nMatched || 0);

    if (!matchedById && /^[a-fA-F0-9]{24}$/.test(sessionId)) {
      const byObjectId = await prisma.$runCommandRaw({
        update: "sessions",
        updates: [
          {
            q: { _id: { $oid: sessionId } },
            u: { $set: updateDoc },
            upsert: false,
            multi: false,
          },
        ],
      });

      const matchedByObjectId = Number(
        byObjectId?.n || byObjectId?.nMatched || 0
      );

      if (!matchedByObjectId) {
        return res.status(404).json({
          success: false,
          message: "session not found",
        });
      }

      const found = await prisma.$runCommandRaw({
        find: "sessions",
        filter: { _id: { $oid: sessionId } },
        limit: 1,
      });

      const doc = found?.cursor?.firstBatch?.[0] || null;

      return res.json({
        success: true,
        message: "session updated",
        data: doc ? mapSessionDoc(doc) : null,
      });
    }

    if (!matchedById) {
      return res.status(404).json({
        success: false,
        message: "session not found",
      });
    }

    const found = await prisma.$runCommandRaw({
      find: "sessions",
      filter: { id: sessionId },
      limit: 1,
    });

    const doc = found?.cursor?.firstBatch?.[0] || null;

    return res.json({
      success: true,
      message: "session updated",
      data: doc ? mapSessionDoc(doc) : null,
    });
  } catch (error) {
    console.error("PUT /api/admin/session/:sessionId error:", error);
    return res.status(500).json({
      success: false,
      message: "failed to update session",
      error: error.message,
    });
  }
});

app.delete("/api/admin/session/:sessionId", requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const byId = await prisma.$runCommandRaw({
      delete: "sessions",
      deletes: [
        {
          q: { id: sessionId },
          limit: 1,
        },
      ],
    });

    const deletedById = Number(byId?.n || byId?.deletedCount || 0);

    if (!deletedById && /^[a-fA-F0-9]{24}$/.test(sessionId)) {
      const byObjectId = await prisma.$runCommandRaw({
        delete: "sessions",
        deletes: [
          {
            q: { _id: { $oid: sessionId } },
            limit: 1,
          },
        ],
      });

      const deletedByObjectId = Number(
        byObjectId?.n || byObjectId?.deletedCount || 0
      );

      if (!deletedByObjectId) {
        return res.status(404).json({
          success: false,
          message: "session not found",
        });
      }

      return res.json({
        success: true,
        message: "session deleted",
      });
    }

    if (!deletedById) {
      return res.status(404).json({
        success: false,
        message: "session not found",
      });
    }

    return res.json({
      success: true,
      message: "session deleted",
    });
  } catch (error) {
    console.error("DELETE /api/admin/session/:sessionId error:", error);
    return res.status(500).json({
      success: false,
      message: "failed to delete session",
      error: error.message,
    });
  }
});

app.delete("/api/admin/session", requireAdmin, async (req, res) => {
  try {
    const sessionId = String(req.body?.id || "").trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "missing session id",
      });
    }

    const byId = await prisma.$runCommandRaw({
      delete: "sessions",
      deletes: [
        {
          q: { id: sessionId },
          limit: 1,
        },
      ],
    });

    const deletedById = Number(byId?.n || byId?.deletedCount || 0);

    if (!deletedById && /^[a-fA-F0-9]{24}$/.test(sessionId)) {
      const byObjectId = await prisma.$runCommandRaw({
        delete: "sessions",
        deletes: [
          {
            q: { _id: { $oid: sessionId } },
            limit: 1,
          },
        ],
      });

      const deletedByObjectId = Number(
        byObjectId?.n || byObjectId?.deletedCount || 0
      );

      if (!deletedByObjectId) {
        return res.status(404).json({
          success: false,
          message: "session not found",
        });
      }

      return res.json({
        success: true,
        message: "session deleted",
      });
    }

    if (!deletedById) {
      return res.status(404).json({
        success: false,
        message: "session not found",
      });
    }

    return res.json({
      success: true,
      message: "session deleted",
    });
  } catch (error) {
    console.error("DELETE /api/admin/session error:", error);
    return res.status(500).json({
      success: false,
      message: "failed to delete session",
      error: error.message,
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(4000, () => {
      console.log("Server running on http://localhost:4000");
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

