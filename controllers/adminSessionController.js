import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const isObjectIdHex = (value) => typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

const objectIdToString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.$oid) return value.$oid;
  return String(value);
};

const buildCourseIdFilter = (courseId) => {
  const id = String(courseId || "").trim();
  if (!id) return {};

  if (isObjectIdHex(id)) {
    return {
      $or: [{ courseId: id }, { courseId: { $oid: id } }],
    };
  }

  return { courseId: id };
};

export const mapSessionDoc = (doc) => {
  const _id = objectIdToString(doc?._id);
  const id = String(doc?.id || "").trim() || _id;

  const instructorId =
    String(doc?.instructorId || "").trim() ||
    objectIdToString(doc?.teacherId) ||
    String(doc?.teacherId || "").trim();

  return {
    _id,
    id,
    title:
      String(doc?.title || "").trim() ||
      String(doc?.name || "").trim() ||
      String(doc?.sessionName || "").trim() ||
      "",
    startDate: String(doc?.startDate || doc?.date || "").trim(),
    endDate: String(doc?.endDate || doc?.date || "").trim(),
    startTime: String(doc?.startTime || "").trim(),
    endTime: String(doc?.endTime || "").trim(),
    location: String(doc?.location || "").trim(),
    meetingLink: String(doc?.meetingLink || doc?.meetLink || "").trim(),
    capacity: doc?.capacity ?? doc?.maxSeats ?? "",
    instructorId,
    instructorName: String(doc?.instructorName || doc?.teacherName || "").trim(),
    status: String(doc?.status || "").trim(),
    bookedSeats: doc?.bookedSeats ?? doc?.booked ?? doc?.seatsBooked ?? 0,
  };
};

export const getAdminSessions = async (req, res) => {
  try {
    const courseId = String(req.query?.courseId || "").trim();

    if (!courseId) {
      return res.json([]);
    }

    const filter = buildCourseIdFilter(courseId);

    const result = await prisma.$runCommandRaw({
      find: "sessions",
      filter,
      sort: { createdAt: -1 },
    });

    const docs = Array.isArray(result?.cursor?.firstBatch)
      ? result.cursor.firstBatch
      : [];

    return res.json(docs.map(mapSessionDoc));
  } catch (error) {
    console.error("getAdminSessions error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึง sessions ของคอร์ส",
      error: error.message,
    });
  }
};

