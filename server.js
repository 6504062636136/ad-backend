import express from "express";
import cors from "cors";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API running");
});

// 1) list users
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

// 2) stats ต้องอยู่ก่อน :id
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

// 3) get by id
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
app.get("/api/test-server", (req, res) => {
  res.json({ message: "backend updated OK" });
});
// 4) create
app.post("/api/admin/users", async (req, res) => {
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
      degreeCertificateUrl,
      teachingLicenseUrl,
      transcriptUrl,
      photoUrl,
      role,
      status,
    } = req.body;

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
    console.error("POST /api/admin/users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5) update
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

// 6) delete
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

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});