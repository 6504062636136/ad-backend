import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalTeachers = await prisma.user.count({ where: { role: "teacher" } });
    const totalStudents = await prisma.user.count({ where: { role: "student" } });
    const totalCourses = await prisma.course.count();

    const pendingTeachers = await prisma.user.count({ 
      where: { role: "teacher", status: { equals: "Pending", mode: "insensitive" } } 
    });

    const pendingCourses = await prisma.course.count({ 
      where: { status: { equals: "pending", mode: "insensitive" } } 
    });

    const revenue = 0;

    return res.json({
      success: true,
      message: "ดึงข้อมูลสถิติสำเร็จ",
      data: {
        totalUsers,
        totalTeachers,
        totalStudents,
        totalCourses,
        pendingTeachers,
        pendingCourses,
        revenue
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงสถิติ Dashboard",
      error: error.message
    });
  }
};

export const getPendingTeachers = async (req, res) => {
  try {
    const pendingTeachers = await prisma.user.findMany({
      where: {
        role: "teacher",
        status: { equals: "Pending", mode: "insensitive" }
      },
      orderBy: { createdAt: "desc" },
    });

    const mappedTeachers = pendingTeachers.map((u) => ({
      ...u,
      name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()
    }));

    return res.json({
      success: true,
      message: "ดึงรายการครูที่รอการอนุมัติสำเร็จ",
      data: mappedTeachers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรายการครูที่รอการอนุมัติ",
      error: error.message
    });
  }
};
export const getAdminUsers = async (req, res) => {
  try {
    const { role = "", status = "", keyword = "" } = req.query;

    const where = {};

    if (role && role !== "all") {
      where.role = { equals: role, mode: "insensitive" };
    }

    if (status && status !== "all") {
      where.status = { equals: status, mode: "insensitive" };
    }

    if (keyword && keyword.trim() !== "") {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { firstName: { contains: keyword, mode: "insensitive" } },
        { lastName: { contains: keyword, mode: "insensitive" } },
        { email: { contains: keyword, mode: "insensitive" } },
      ];
    }

    let users = [];

    try {
      users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      console.error("prisma.user.findMany error in getAdminUsers:", error);

      const rawUsers = await prisma.user.findRaw({
        filter: {},
      });

      users = (rawUsers || []).map((u) => ({
        id: u?._id?.$oid || String(u?._id || ""),
        _id: u?._id?.$oid || String(u?._id || ""),
        firstName: u?.firstName || "",
        lastName: u?.lastName || "",
        name: u?.name || `${u?.firstName || ""} ${u?.lastName || ""}`.trim(),
        email: u?.email || "",
        role: u?.role || "",
        status: u?.status || "",
        phone: u?.phone || "",
        createdAt: u?.createdAt?.$date || u?.createdAt || null,
        updatedAt: u?.updatedAt?.$date || u?.updatedAt || null,
      }));

      if (role && role !== "all") {
        users = users.filter(
          (u) => String(u.role || "").toLowerCase() === String(role).toLowerCase()
        );
      }

      if (status && status !== "all") {
        users = users.filter(
          (u) => String(u.status || "").toLowerCase() === String(status).toLowerCase()
        );
      }

      if (keyword && keyword.trim() !== "") {
        const lower = keyword.toLowerCase();
        users = users.filter((u) => {
          return (
            String(u.name || "").toLowerCase().includes(lower) ||
            String(u.firstName || "").toLowerCase().includes(lower) ||
            String(u.lastName || "").toLowerCase().includes(lower) ||
            String(u.email || "").toLowerCase().includes(lower)
          );
        });
      }

      users.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }

    const mappedUsers = users.map((u) => ({
      ...u,
      name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
    }));

    return res.json({
      success: true,
      message: "ดึงรายการผู้ใช้สำเร็จ",
      data: mappedUsers,
    });
  } catch (error) {
    console.error("getAdminUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรายการผู้ใช้",
      error: error.message,
    });
  }
};
export const approveTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "teacher not found - ไม่พบข้อมูลผู้ใช้รายนี้"
      });
    }

    if ((user.role || "").toLowerCase() !== "teacher") {
      return res.status(400).json({
        success: false,
        message: "ผู้ใช้รายนี้ไม่ใช่ครู"
      });
    }

    if (
      (user.status || "").toLowerCase() === "active" ||
      (user.status || "").toLowerCase() === "active_teacher"
    ) {
      return res.status(400).json({
        success: false,
        message: "teacher already approved - ครูรายนี้ได้รับการอนุมัติไปแล้ว"
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "Active" }
    });

    return res.json({
      success: true,
      message: "อนุมัติครูสำเร็จ",
      data: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอนุมัติ",
      error: error.message
    });
  }
};

export const rejectTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "teacher not found - ไม่พบข้อมูลผู้ใช้รายนี้"
      });
    }

    if ((user.role || "").toLowerCase() !== "teacher") {
      return res.status(400).json({
        success: false,
        message: "ผู้ใช้รายนี้ไม่ใช่ครู"
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "Rejected" }
    });

    return res.json({
      success: true,
      message: "ปฏิเสธครูสำเร็จ",
      data: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการปฏิเสธ",
      error: error.message
    });
  }
};