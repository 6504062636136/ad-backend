import express from "express";
import cors from "cors";
import pkg from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------
// สร้างโฟลเดอร์เก็บไฟล์
// --------------------
const photoUploadDir = path.join(__dirname, "uploads", "teachers", "photos");
const documentUploadDir = path.join(__dirname, "uploads", "teachers", "documents");

fs.mkdirSync(photoUploadDir, { recursive: true });
fs.mkdirSync(documentUploadDir, { recursive: true });

// --------------------
// ตั้งค่า multer
// --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "photo") {
      cb(null, photoUploadDir);
    } else {
      cb(null, documentUploadDir);
    }
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

  cb(new Error("Unexpected file field"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

app.use(cors());
app.use(express.json());

// เปิดไฟล์ใน uploads ผ่าน URL
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/api/test-server", (req, res) => {
  res.json({ message: "backend updated OK" });
});

// --------------------
// GET users
// --------------------
app.get("/api/admin/users", async (req, res) => {
  try {
    const { role, search = "" } = req.query;

    const where = {};

    if (role) {
      where.role = role;
    }

    if (search && search.trim() !== "") {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --------------------
// GET stats
// --------------------
app.get("/api/admin/users/stats", async (req, res) => {
  try {
    const { role } = req.query;

    const baseWhere = role ? { role } : {};

    const total = await prisma.user.count({
      where: baseWhere,
    });

    const active = await prisma.user.count({
      where: {
        ...baseWhere,
        status: "Active",
      },
    });

    const pending = await prisma.user.count({
      where: {
        ...baseWhere,
        status: "Pending",
      },
    });

    const inactive = await prisma.user.count({
      where: {
        ...baseWhere,
        status: "Inactive",
      },
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

// --------------------
// GET user by id
// --------------------
app.get("/api/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    res.json(user);
  } catch (error) {
    console.error("GET /api/admin/users/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --------------------
// CREATE user พร้อมรับไฟล์
// --------------------
app.post(
  "/api/admin/users",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
    { name: "teachingLicense", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("BODY EMAIL =", req.body.email);
      console.log("BODY FULL =", req.body);
      console.log("FILES =", req.files);

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
        role,
        status,
      } = req.body;

      const photoFile = req.files?.photo?.[0];
      const degreeCertificateFile = req.files?.degreeCertificate?.[0];
      const teachingLicenseFile = req.files?.teachingLicense?.[0];
      const transcriptFile = req.files?.transcript?.[0];

      const existingUser = await prisma.user.findFirst({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({
          error: `อีเมลนี้มีอยู่แล้วในระบบ: ${email}`,
        });
      }

      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          name: name || `${firstName || ""} ${lastName || ""}`.trim(),
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
          role,
          status,
          photoUrl: photoFile
            ? `/uploads/teachers/photos/${photoFile.filename}`
            : null,
          degreeCertificateUrl: degreeCertificateFile
            ? `/uploads/teachers/documents/${degreeCertificateFile.filename}`
            : null,
          teachingLicenseUrl: teachingLicenseFile
            ? `/uploads/teachers/documents/${teachingLicenseFile.filename}`
            : null,
          transcriptUrl: transcriptFile
            ? `/uploads/teachers/documents/${transcriptFile.filename}`
            : null,
        },
      });

      res.json(user);
    } catch (error) {
      console.error("POST /api/admin/users error:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          error: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น",
        });
      }

      res.status(500).json({ error: error.message });
    }
  }
);

// --------------------
// UPDATE user
// --------------------
app.put("/api/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

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
      degreeCertificateUrl,
      teachingLicenseUrl,
      transcriptUrl,
      photoUrl,
      role,
      status,
    } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        name: name || `${firstName || ""} ${lastName || ""}`.trim(),
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
        degreeCertificateUrl,
        teachingLicenseUrl,
        transcriptUrl,
        photoUrl,
        role,
        status,
      },
    });

    res.json(user);
  } catch (error) {
    console.error("PUT /api/admin/users/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --------------------
// DELETE user
// --------------------
app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/admin/users/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --------------------
// handle multer error
// --------------------
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});