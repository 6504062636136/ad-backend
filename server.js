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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/api/test-server", (req, res) => {
  res.json({ message: "backend updated OK" });
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const { role, search = "" } = req.query;

    const where = {};

    if (role && role.trim() !== "") {
      where.role = role.trim().toLowerCase();
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

    console.log("GET USERS where =", where);

    const users = await prisma.user.findMany({
      where,
    });

    console.log("GET USERS result =", users);

    res.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error full =", error);
    console.error("GET /api/admin/users error message =", error?.message);
    console.error("GET /api/admin/users error code =", error?.code);
    res.status(500).json({ error: error.message });
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

app.post(
  "/api/admin/users",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
    { name: "teachingLicense", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
    { name: "studentCard", maxCount: 1 },
  ]),
  async (req, res) => {
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

      const normalizedRole = (role || "teacher").trim().toLowerCase();

      const photoFile = req.files?.photo?.[0];
      const degreeCertificateFile = req.files?.degreeCertificate?.[0];
      const teachingLicenseFile = req.files?.teachingLicense?.[0];
      const transcriptFile = req.files?.transcript?.[0];
      const studentCardFile = req.files?.studentCard?.[0];

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
          role: normalizedRole,
          status: status || "Active",

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
            ? getFileUrlByRole(normalizedRole, "transcript", transcriptFile.filename)
            : null,
          studentCardUrl: studentCardFile
            ? getFileUrlByRole(normalizedRole, "studentCard", studentCardFile.filename)
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

app.delete("/api/admin/users/:id", async (req, res) => {
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

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/admin/users/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put(
  "/api/admin/users/:id",
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

      res.json(updatedUser);
    } catch (error) {
      console.error("PUT /api/admin/users/:id error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

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