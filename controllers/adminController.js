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

    const revenue = 0; // Dummy value since no payment table exists yet

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
     return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการดึงสถิติ Dashboard", error: error.message });
  }
};

export const approveTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
        return res.status(404).json({ success: false, message: "teacher not found - ไม่พบข้อมูลผู้ใช้รายนี้" });
    }
    if ((user.role || "").toLowerCase() !== "teacher") {
        return res.status(400).json({ success: false, message: "ผู้ใช้รายนี้ไม่ใช่ครู" });
    }
    // Prevent duplicate approvals
    if ((user.status || "").toLowerCase() === "active" || (user.status || "").toLowerCase() === "active_teacher") {
        return res.status(400).json({ success: false, message: "teacher already approved - ครูรายนี้ได้รับการอนุมัติไปแล้ว" });
    }
    
    // Update status to Active
    const updated = await prisma.user.update({
        where: { id },
        data: { status: "Active" } 
    });

    return res.json({ success: true, message: "อนุมัติครูสำเร็จ", data: updated });
  } catch(error) {
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอนุมัติ", error: error.message });
  }
};

export const rejectTeacher = async (req, res) => {
   try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
        return res.status(404).json({ success: false, message: "teacher not found - ไม่พบข้อมูลผู้ใช้รายนี้" });
    }
    if ((user.role || "").toLowerCase() !== "teacher") {
         return res.status(400).json({ success: false, message: "ผู้ใช้รายนี้ไม่ใช่ครู" });
    }
    
    const updated = await prisma.user.update({
        where: { id },
        data: { status: "Rejected" } 
    });

    return res.json({ success: true, message: "ปฏิเสธครูสำเร็จ", data: updated });
  } catch(error) {
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการปฏิเสธ", error: error.message });
  }
};
