import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const toBoolean = (value, defaultValue = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return defaultValue;
};

const toNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeCurriculum = (curriculum) => {
  if (!Array.isArray(curriculum)) return [];

  return curriculum.map((section, sectionIndex) => ({
    id: section?.id || `section-${Date.now()}-${sectionIndex}`,
    title: String(section?.title || "").trim(),
    description: String(section?.description || "").trim(),
    lessons: Array.isArray(section?.lessons)
      ? section.lessons.map((lesson, lessonIndex) => ({
          id: lesson?.id || `lesson-${Date.now()}-${sectionIndex}-${lessonIndex}`,
          title: String(lesson?.title || "").trim(),
          type: ["video", "pdf", "quiz", "text"].includes(lesson?.type)
            ? lesson.type
            : "video",
          duration: String(lesson?.duration || "").trim(),
          fileUrl: String(lesson?.fileUrl || "").trim(),
          content: String(lesson?.content || "").trim(),
        }))
      : [],
  }));
};

const parseRequestData = (req) => {
  if (req.body?.data) {
    return JSON.parse(req.body.data);
  }
  return req.body || {};
};

const getThumbnailUrl = (req) => {
  if (!req.file?.filename) return "";
  return `/uploads/courses/${req.file.filename}`;
};

const formatInstructor = (teacher) => {
  if (!teacher) return null;

  return {
    _id: teacher.id,
    id: teacher.id,
    name:
      teacher.name ||
      `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim(),
    firstName: teacher.firstName || "",
    lastName: teacher.lastName || "",
    email: teacher.email || "",
  };
};

const formatLegacyInstructor = (name = "") => {
  if (!name) return null;

  return {
    _id: "",
    id: "",
    name,
    firstName: "",
    lastName: "",
    email: "",
  };
};

const rawIdToString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.$oid) return value.$oid;
  return String(value);
};

const rawDateToValue = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.$date) return value.$date;
  return value;
};

const mapRawCourse = (course) => ({
  _id: rawIdToString(course?._id),
  id: rawIdToString(course?._id),
  title: course?.title || "Untitled Course",
  shortDescription: course?.shortDescription || "",
  description: course?.description || "",
  category: course?.category || "",
  thumbnailUrl: course?.thumbnailUrl || course?.imageUrl || "",
  imageUrl: course?.imageUrl || "",
  price: Number(course?.price || 0),
  discountPrice: Number(course?.discountPrice || 0),
  isFree: typeof course?.isFree === "boolean" ? course.isFree : false,
  status: course?.status || "published",
  visibility: course?.visibility || "public",
  level: course?.level || "beginner",
  durationText:
    course?.durationText ||
    course?.time ||
    (course?.durationHours ? `${course.durationHours} hours` : ""),
  time: course?.time || "",
  maxStudents: Number(course?.maxStudents || 0),
  allowEnrollment:
    typeof course?.allowEnrollment === "boolean"
      ? course.allowEnrollment
      : true,
  hasCertificate: Boolean(course?.hasCertificate),
  featured:
    typeof course?.featured === "boolean"
      ? course.featured
      : Boolean(course?.isHotCourse),
  createdAt: rawDateToValue(course?.createdAt),
  updatedAt: rawDateToValue(course?.updatedAt),
  instructorId: course?.instructorId ? rawIdToString(course.instructorId) : "",
  instructor: course?.instructorId
    ? null
    : formatLegacyInstructor(course?.instructor || ""),
  requirements: Array.isArray(course?.requirements) ? course.requirements : [],
  objectives: Array.isArray(course?.objectives) ? course.objectives : [],
  curriculum: Array.isArray(course?.curriculum) ? course.curriculum : [],
});

const validateCoursePayload = async (payload) => {
  if (!payload.title) return "กรุณากรอกชื่อคอร์ส";
  if (!payload.category) return "กรุณาเลือกหมวดหมู่";
  if (!payload.instructorId) return "กรุณาเลือกครูผู้สอน";  if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) return "วันหลัง end date ต้องมากกว่า start date";

  const teacher = await prisma.user.findUnique({
    where: { id: payload.instructorId },
  });

  if (!teacher) return "ไม่พบข้อมูลครูผู้สอน";
  if ((teacher.role || "").toLowerCase() !== "teacher") {
    return "ผู้ใช้ที่เลือกไม่ใช่ครู";
  }

  if (!payload.isFree && payload.price <= 0) {
    return "กรุณากรอกราคาให้มากกว่า 0 หรือเลือกเป็นคอร์สฟรี";
  }

  if (!payload.isFree && payload.discountPrice > payload.price) {
    return "ราคาส่วนลดต้องไม่มากกว่าราคาปกติ";
  }

  return null;
};

export const getAdminCourses = async (req, res) => {
  try {
    const { keyword = "", status = "all" } = req.query;

    const where = {};

    if (status && status !== "all") {
      where.status = { equals: status, mode: "insensitive" };
    }

    if (keyword && keyword.trim() !== "") {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { category: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { shortDescription: { contains: keyword, mode: "insensitive" } },
      ];
    }

    console.log("GET COURSES where =", where);

    let courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    console.log("GET COURSES prisma.findMany count =", courses.length);

    let result = [];

    if (courses.length > 0) {
      const instructorIds = [
        ...new Set(courses.map((item) => item.instructorId).filter(Boolean)),
      ];

      const teachers = instructorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: instructorIds } },
          })
        : [];

      const teacherMap = new Map(teachers.map((item) => [item.id, item]));

      result = courses.map((course) => {
        const sessionCount = Array.isArray(course.curriculum)
          ? course.curriculum.reduce(
              (acc, sec) => acc + (Array.isArray(sec.lessons) ? sec.lessons.length : 0),
              0
            )
          : 0;

        return {
          _id: course.id,
          id: course.id,
          title: course.title || "Untitled Course",
          shortDescription: course.shortDescription || "",
          description: course.description || "",
          category: course.category || "",
          thumbnailUrl: course.thumbnailUrl || course.imageUrl || "",
          imageUrl: course.imageUrl || "",
          price: course.price || 0,
          discountPrice: course.discountPrice || 0,
          isFree: typeof course.isFree === "boolean" ? course.isFree : false,
          status: course.status || "published",
          visibility: course.visibility || "public",
          level: course.level || "beginner",
          durationText:
            course.durationText ||
            course.time ||
            (course.durationHours ? `${course.durationHours} hours` : ""),
          time: course.time || "",
          maxStudents: course.maxStudents || 0,
          allowEnrollment:
            typeof course.allowEnrollment === "boolean"
              ? course.allowEnrollment
              : true,
          hasCertificate: Boolean(course.hasCertificate),
          featured:
            typeof course.featured === "boolean"
              ? course.featured
              : Boolean(course.isHotCourse),
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
          sessionCount,
          instructorId: course.instructorId || "",
          instructor: course.instructorId
            ? formatInstructor(teacherMap.get(course.instructorId))
            : formatLegacyInstructor(course.instructor || ""),
        };
      });
    } else {
      const rawCourses = await prisma.course.findRaw({
        filter: {},
      });

      console.log("GET COURSES prisma.findRaw count =", rawCourses?.length || 0);

      result = (rawCourses || []).map(mapRawCourse).map((course) => {
        const sessionCount = Array.isArray(course.curriculum)
          ? course.curriculum.reduce(
              (acc, sec) => acc + (Array.isArray(sec.lessons) ? sec.lessons.length : 0),
              0
            )
          : 0;
        return { ...course, sessionCount };
      });

      if (keyword && keyword.trim() !== "") {
        const lower = keyword.toLowerCase();
        result = result.filter((course) => {
          return (
            (course.title || "").toLowerCase().includes(lower) ||
            (course.category || "").toLowerCase().includes(lower) ||
            (course.description || "").toLowerCase().includes(lower) ||
            (course.shortDescription || "").toLowerCase().includes(lower)
          );
        });
      }

      if (status && status !== "all") {
        result = result.filter(
          (course) => (course.status || "published").toLowerCase() === status.toLowerCase()
        );
      }

      result.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }

    return res.json({
      success: true,
      message: "ดึงรายการคอร์สสำเร็จ",
      data: result,
    });
  } catch (error) {
    console.error("getAdminCourses error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรายการคอร์ส",
      error: error.message,
    });
  }
};

export const getPendingCourses = async (req, res) => {
  try {
    const { keyword = "" } = req.query;

    const where = { status: { equals: "pending", mode: "insensitive" } };

    if (keyword && keyword.trim() !== "") {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { category: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { shortDescription: { contains: keyword, mode: "insensitive" } },
      ];
    }

    console.log("GET PENDING COURSES where =", where);

    let courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    console.log("GET PENDING COURSES prisma.findMany count =", courses.length);

    let result = [];

    if (courses.length > 0) {
      const instructorIds = [
        ...new Set(courses.map((item) => item.instructorId).filter(Boolean)),
      ];

      const teachers = instructorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: instructorIds } },
          })
        : [];

      const teacherMap = new Map(teachers.map((item) => [item.id, item]));

      result = courses.map((course) => {
        const sessionCount = Array.isArray(course.curriculum)
          ? course.curriculum.reduce(
              (acc, sec) => acc + (Array.isArray(sec.lessons) ? sec.lessons.length : 0),
              0
            )
          : 0;

        return {
          _id: course.id,
          id: course.id,
          title: course.title || "Untitled Course",
          shortDescription: course.shortDescription || "",
          description: course.description || "",
          category: course.category || "",
          thumbnailUrl: course.thumbnailUrl || course.imageUrl || "",
          imageUrl: course.imageUrl || "",
          price: course.price || 0,
          discountPrice: course.discountPrice || 0,
          isFree: typeof course.isFree === "boolean" ? course.isFree : false,
          status: course.status || "published",
          visibility: course.visibility || "public",
          level: course.level || "beginner",
          durationText:
            course.durationText ||
            course.time ||
            (course.durationHours ? `${course.durationHours} hours` : ""),
          time: course.time || "",
          maxStudents: course.maxStudents || 0,
          allowEnrollment:
            typeof course.allowEnrollment === "boolean"
              ? course.allowEnrollment
              : true,
          hasCertificate: Boolean(course.hasCertificate),
          featured:
            typeof course.featured === "boolean"
              ? course.featured
              : Boolean(course.isHotCourse),
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
          sessionCount,
          instructorId: course.instructorId || "",
          instructor: course.instructorId
            ? formatInstructor(teacherMap.get(course.instructorId))
            : formatLegacyInstructor(course.instructor || ""),
        };
      });
    } else {
      const rawCourses = await prisma.course.findRaw({
        filter: { status: "pending" },
      });

      console.log(
        "GET PENDING COURSES prisma.findRaw count =",
        rawCourses?.length || 0
      );

      result = (rawCourses || []).map(mapRawCourse).map((course) => {
        const sessionCount = Array.isArray(course.curriculum)
          ? course.curriculum.reduce(
              (acc, sec) => acc + (Array.isArray(sec.lessons) ? sec.lessons.length : 0),
              0
            )
          : 0;
        return { ...course, sessionCount };
      });

      if (keyword && keyword.trim() !== "") {
        const lower = keyword.toLowerCase();
        result = result.filter((course) => {
          return (
            (course.title || "").toLowerCase().includes(lower) ||
            (course.category || "").toLowerCase().includes(lower) ||
            (course.description || "").toLowerCase().includes(lower) ||
            (course.shortDescription || "").toLowerCase().includes(lower)
          );
        });
      }

      result.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }

    return res.json({
      success: true,
      message: "ดึงรายการคอร์สที่รอการอนุมัติสำเร็จ",
      data: result,
    });
  } catch (error) {
    console.error("getPendingCourses error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรายการคอร์สที่รอการอนุมัติ",
      error: error.message,
    });
  }
};

export const createAdminCourse = async (req, res) => {
  try {
    const rawData = parseRequestData(req);
    console.log("createAdminCourse rawData:", rawData);

    const payload = {
      title: String(rawData.title || "").trim(),
      shortDescription: String(rawData.shortDescription || "").trim(),
      description: String(rawData.description || "").trim(),
      category: String(rawData.category || "").trim(),
      instructorId: String(rawData.instructorId || "").trim(),
      thumbnailUrl: getThumbnailUrl(req) || String(rawData.thumbnailUrl || "").trim(),
      price: toNumber(rawData.price, 0),
      discountPrice: toNumber(rawData.discountPrice, 0),
      isFree: toBoolean(rawData.isFree, false),
      status: String(rawData.status || "draft").trim(),
      visibility: String(rawData.visibility || "private").trim(),
      level: String(rawData.level || "beginner").trim(),
      durationText: String(rawData.durationText || "").trim(),
      startDate: String(rawData.startDate || "").trim(),
      endDate: String(rawData.endDate || "").trim(),
      startTime: String(rawData.startTime || "").trim(),
      endTime: String(rawData.endTime || "").trim(),
      maxStudents: toNumber(rawData.maxStudents, 0),
      requirements: normalizeStringArray(rawData.requirements),
      objectives: normalizeStringArray(rawData.objectives),
      allowEnrollment: toBoolean(rawData.allowEnrollment, true),
      hasCertificate: toBoolean(rawData.hasCertificate, false),
      featured: toBoolean(rawData.featured, false),
      curriculum: normalizeCurriculum(rawData.curriculum),
      sessions: rawData.sessions || [],
    };

    console.log("createAdminCourse payload:", payload);

    const validationError = await validateCoursePayload(payload);

    if (validationError) {
      console.log("createAdminCourse validation error:", validationError);
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const created = await prisma.course.create({
      data: payload,
    });

    console.log("createAdminCourse created:", created);

    return res.status(201).json({
      success: true,
      message: "เพิ่มคอร์สสำเร็จ",
      data: {
        _id: created.id,
        id: created.id,
        ...created,
      },
    });
  } catch (error) {
    console.error("createAdminCourse error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการเพิ่มคอร์ส",
      error: error.message,
    });
  }
};

export const updateAdminCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.course.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบคอร์สนี้",
      });
    }

    const rawData = parseRequestData(req);

    const sessionsRequested = Object.prototype.hasOwnProperty.call(rawData || {}, "sessions");

    const sessions = sessionsRequested
      ? Array.isArray(rawData.sessions)
        ? rawData.sessions
        : []
      : null;

    const isPending = String(existing.status || "").trim().toLowerCase() === "pending";

    const courseIdFilter =
      typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id)
        ? { $or: [{ courseId: id }, { courseId: { $oid: id } }] }
        : { courseId: id };

    let courseUpdate = {};

    if ("title" in rawData) courseUpdate.title = String(rawData.title || "").trim();
    if ("shortDescription" in rawData) {
      courseUpdate.shortDescription = String(rawData.shortDescription || "").trim();
    }
    if ("description" in rawData) {
      courseUpdate.description = String(rawData.description || "").trim();
    }
    if ("category" in rawData) {
      courseUpdate.category = String(rawData.category || "").trim();
    }
    if ("instructorId" in rawData) {
      courseUpdate.instructorId = String(rawData.instructorId || "").trim();
    }

    if (req.file?.filename) {
      courseUpdate.thumbnailUrl = `/uploads/courses/${req.file.filename}`;
    } else if ("thumbnailUrl" in rawData) {
      courseUpdate.thumbnailUrl = String(rawData.thumbnailUrl || "").trim();
    }

    if ("price" in rawData) courseUpdate.price = toNumber(rawData.price, existing.price || 0);
    if ("discountPrice" in rawData) {
      courseUpdate.discountPrice = toNumber(rawData.discountPrice, existing.discountPrice || 0);
    }
    if ("isFree" in rawData) {
      courseUpdate.isFree = toBoolean(
        rawData.isFree,
        typeof existing.isFree === "boolean" ? existing.isFree : false
      );
    }

    if ("status" in rawData) courseUpdate.status = String(rawData.status || "").trim();
    if ("visibility" in rawData) {
      courseUpdate.visibility = String(rawData.visibility || "").trim();
    }
    if ("level" in rawData) courseUpdate.level = String(rawData.level || "").trim();
    if ("durationText" in rawData) {
      courseUpdate.durationText = String(rawData.durationText || "").trim();
    }
    if ("startDate" in rawData) courseUpdate.startDate = String(rawData.startDate || "").trim();
    if ("endDate" in rawData) courseUpdate.endDate = String(rawData.endDate || "").trim();
    if ("startTime" in rawData) courseUpdate.startTime = String(rawData.startTime || "").trim();
    if ("endTime" in rawData) courseUpdate.endTime = String(rawData.endTime || "").trim();

    if ("maxStudents" in rawData) {
      courseUpdate.maxStudents = toNumber(rawData.maxStudents, existing.maxStudents || 0);
    }
    if ("requirements" in rawData) {
      courseUpdate.requirements = normalizeStringArray(rawData.requirements);
    }
    if ("objectives" in rawData) {
      courseUpdate.objectives = normalizeStringArray(rawData.objectives);
    }
    if ("allowEnrollment" in rawData) {
      courseUpdate.allowEnrollment = toBoolean(
        rawData.allowEnrollment,
        typeof existing.allowEnrollment === "boolean" ? existing.allowEnrollment : true
      );
    }
    if ("hasCertificate" in rawData) {
      courseUpdate.hasCertificate = toBoolean(
        rawData.hasCertificate,
        typeof existing.hasCertificate === "boolean" ? existing.hasCertificate : false
      );
    }
    if ("featured" in rawData) {
      courseUpdate.featured = toBoolean(
        rawData.featured,
        typeof existing.featured === "boolean" ? existing.featured : false
      );
    }
    if ("curriculum" in rawData) {
      courseUpdate.curriculum = normalizeCurriculum(rawData.curriculum);
    }

    const hasCourseUpdates = Object.keys(courseUpdate).length > 0;

    const upsertSessions = async () => {
      if (!sessionsRequested) return;

      const now = new Date();

      await prisma.$runCommandRaw({
        delete: "sessions",
        deletes: [{ q: courseIdFilter, limit: 0 }],
      });

      if (sessions.length === 0) return;

      await prisma.$runCommandRaw({
        insert: "sessions",
        documents: sessions.map((s) => ({
          ...s,
          courseId: id,
          createdAt: now,
          updatedAt: now,
        })),
      });
    };

    if (isPending && hasCourseUpdates) {
      if (sessionsRequested) {
        await upsertSessions();
        return res.json({
          success: true,
          message: "เธญเธฑเธเน€เธ”เธ•เธเธญเธฃเนเธชเธชเธณเน€เธฃเนเธ",
          data: {
            _id: existing.id,
            id: existing.id,
            ...existing,
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: "คอร์สสถานะ pending ไม่สามารถแก้ไขได้",
      });
    }

    if (hasCourseUpdates) {
      const payloadForValidation = {
        title:
          "title" in courseUpdate ? courseUpdate.title : String(existing.title || "").trim(),
        category:
          "category" in courseUpdate
            ? courseUpdate.category
            : String(existing.category || "").trim(),
        instructorId:
          "instructorId" in courseUpdate
            ? courseUpdate.instructorId
            : String(existing.instructorId || "").trim(),
        isFree:
          "isFree" in courseUpdate
            ? courseUpdate.isFree
            : typeof existing.isFree === "boolean"
              ? existing.isFree
              : false,
        price: "price" in courseUpdate ? courseUpdate.price : existing.price || 0,
        discountPrice:
          "discountPrice" in courseUpdate
            ? courseUpdate.discountPrice
            : existing.discountPrice || 0,
        startDate:
          "startDate" in courseUpdate
            ? courseUpdate.startDate
            : String(existing.startDate || "").trim(),
        endDate:
          "endDate" in courseUpdate
            ? courseUpdate.endDate
            : String(existing.endDate || "").trim(),
      };

      const validationError = await validateCoursePayload(payloadForValidation);

      if (validationError) {
        if (sessionsRequested) {
          await upsertSessions();
          courseUpdate = {};
        } else {
          return res.status(400).json({
            success: false,
            message: validationError,
          });
        }
      }
    }

    await upsertSessions();

    const updated =
      Object.keys(courseUpdate).length > 0
        ? await prisma.course.update({
            where: { id },
            data: courseUpdate,
          })
        : existing;

    return res.json({
      success: true,
      message: "อัปเดตคอร์สสำเร็จ",
      data: {
        _id: updated.id,
        id: updated.id,
        ...updated,
      },
    });
  } catch (error) {
    console.error("updateAdminCourse error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอัปเดตคอร์ส",
      error: error.message,
    });
  }
};

export const getAdminCourseSessions = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseIdFilter =
      typeof courseId === "string" && /^[a-fA-F0-9]{24}$/.test(courseId)
        ? { $or: [{ courseId }, { courseId: { $oid: courseId } }] }
        : { courseId };

    const result = await prisma.$runCommandRaw({
      find: "sessions",
      filter: courseIdFilter,
    });

    const docs = Array.isArray(result?.cursor?.firstBatch)
      ? result.cursor.firstBatch
      : [];

    if (docs.length > 0) {
      const sessions = docs.map((s) => ({
        ...s,
        _id: s?._id?.$oid || String(s?._id || ""),
        id: s?._id?.$oid || String(s?._id || ""),
      }));
      return res.json(sessions);
    }

    const legacy = await prisma.$runCommandRaw({
      find: "course_sessions",
      filter: { courseId },
      limit: 1,
    });

    const legacyDoc = legacy?.cursor?.firstBatch?.[0] || null;
    const sessions = Array.isArray(legacyDoc?.sessions) ? legacyDoc.sessions : [];

    return res.json(sessions);
  } catch (error) {
    console.error("getAdminCourseSessions error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึง sessions ของคอร์ส",
      error: error.message,
    });
  }
};

export const getAdminCourseSessionsByQuery = async (req, res) => {
  try {
    const courseId = String(req.query?.courseId || "").trim();

    if (!courseId) {
      return res.json([]);
    }

    const courseIdFilter =
      typeof courseId === "string" && /^[a-fA-F0-9]{24}$/.test(courseId)
        ? { $or: [{ courseId }, { courseId: { $oid: courseId } }] }
        : { courseId };

    const result = await prisma.$runCommandRaw({
      find: "sessions",
      filter: courseIdFilter,
    });

    const docs = Array.isArray(result?.cursor?.firstBatch)
      ? result.cursor.firstBatch
      : [];

    if (docs.length > 0) {
      const sessions = docs.map((s) => ({
        ...s,
        _id: s?._id?.$oid || String(s?._id || ""),
        id: s?._id?.$oid || String(s?._id || ""),
      }));
      return res.json(sessions);
    }

    const legacy = await prisma.$runCommandRaw({
      find: "course_sessions",
      filter: { courseId },
      limit: 1,
    });

    const legacyDoc = legacy?.cursor?.firstBatch?.[0] || null;
    const sessions = Array.isArray(legacyDoc?.sessions) ? legacyDoc.sessions : [];

    return res.json(sessions);
  } catch (error) {
    console.error("getAdminCourseSessionsByQuery error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึง sessions ของคอร์ส",
      error: error.message,
    });
  }
};
export const getAdminCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    let course = await prisma.course.findUnique({
      where: { id },
    });

    let teacher = null;
    let students = [];

    if (!course) {
      const rawCourses = await prisma.course.findRaw({
        filter: {},
      });

      const rawCourse = (rawCourses || []).find(
        (item) => rawIdToString(item?._id) === id
      );

      if (!rawCourse) {
        return res.status(404).json({
          success: false,
          message: "ไม่พบคอร์สนี้",
        });
      }

      return res.json({
        success: true,
        message: "ดึงรายละเอียดคอร์สสำเร็จ",
        data: {
          ...mapRawCourse(rawCourse),
          students: [],
        },
      });
    }

    if (course.instructorId) {
      teacher = await prisma.user.findUnique({
        where: { id: course.instructorId },
      });
    }

    try {
      const enrollments = await prisma.userCourse.findMany({
        where: { courseId: id },
      });

      const studentIds = [
        ...new Set(enrollments.map((item) => item.userId).filter(Boolean)),
      ];

      const studentsRaw = studentIds.length
        ? await prisma.user.findMany({
            where: { id: { in: studentIds } },
          })
        : [];

      const studentMap = new Map(studentsRaw.map((item) => [item.id, item]));

      students = enrollments.map((item) => {
        const student = studentMap.get(item.userId);

        return {
          _id: student?.id || item.userId,
          id: student?.id || item.userId,
          name:
            student?.name ||
            `${student?.firstName || ""} ${student?.lastName || ""}`.trim(),
          firstName: student?.firstName || "",
          lastName: student?.lastName || "",
          email: student?.email || "",
          progress: item.progress || 0,
          score: item.score || 0,
          completed: Boolean(item.completed),
          lastAccess: item.lastAccess || null,
        };
      });
    } catch (e) {
      console.error("userCourse read error:", e);
      students = [];
    }

    const sessionCount = Array.isArray(course.curriculum) 
      ? course.curriculum.reduce((acc, sec) => acc + (Array.isArray(sec.lessons) ? sec.lessons.length : 0), 0) 
      : 0;

    return res.json({
      success: true,
      message: "ดึงรายละเอียดคอร์สสำเร็จ",
      data: {
        _id: course.id,
        id: course.id,
        title: course.title || "",
        shortDescription: course.shortDescription || "",
        description: course.description || "",
        category: course.category || "",
        instructorId: course.instructorId || "",
        instructor: course.instructorId
          ? formatInstructor(teacher)
          : formatLegacyInstructor(course.instructor || ""),
        thumbnailUrl: course.thumbnailUrl || course.imageUrl || "",
        imageUrl: course.imageUrl || "",
        price: course.price || 0,
        discountPrice: course.discountPrice || 0,
        isFree: typeof course.isFree === "boolean" ? course.isFree : false,
        status: course.status || "published",
        visibility: course.visibility || "public",
        level: course.level || "beginner",
        durationText:
          course.durationText ||
          course.time ||
          (course.durationHours ? `${course.durationHours} hours` : ""),
        maxStudents: course.maxStudents || 0,
        requirements: Array.isArray(course.requirements) ? course.requirements : [],
        objectives: Array.isArray(course.objectives) ? course.objectives : [],
        allowEnrollment:
          typeof course.allowEnrollment === "boolean"
            ? course.allowEnrollment
            : true,
        time: course.time || "",
        hasCertificate: Boolean(course.hasCertificate),
        featured:
          typeof course.featured === "boolean"
            ? course.featured
            : Boolean(course.isHotCourse),
        curriculum: Array.isArray(course.curriculum) ? course.curriculum : [],
        sessionCount,
        students,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
    });
  } catch (error) {
    console.error("getAdminCourseById error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรายละเอียดคอร์ส",
      error: error.message,
    });
  }
};

export const approveCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "course not found - ไม่พบคอร์สที่ต้องการอนุมัติ",
      });
    }

    if ((course.status || "").toLowerCase() === "published") {
      return res.status(400).json({
        success: false,
        message: "course already approved - คอร์สนี้เผยแพร่ไปแล้ว",
      });
    }

    const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
    const totalSessions = curriculum.reduce(
      (acc, sec) => acc + (Array.isArray(sec.lessons) ? sec.lessons.length : 0),
      0
    );

    if (curriculum.length === 0 && totalSessions === 0) {
      return res.status(400).json({
        success: false,
        message: "course has no sessions - ไม่สามารถอนุมัติได้ คอร์สต้องมีเนื้อหาอย่างน้อย 1 รายการ",
      });
    }

    const updated = await prisma.course.update({
      where: { id },
      data: { status: "published" },
    });

    return res.json({
      success: true,
      message: "อนุมัติคอร์สสำเร็จ",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอนุมัติคอร์ส",
      error: error.message,
    });
  }
};

export const rejectCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "course not found - ไม่พบคอร์สที่ต้องการปฏิเสธ",
      });
    }

    const updated = await prisma.course.update({
      where: { id },
      data: { status: "rejected" },
    });

    return res.json({
      success: true,
      message: "ปฏิเสธคอร์สสำเร็จ",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการปฏิเสธคอร์ส",
      error: error.message,
    });
  }
};

export const archiveCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "course not found - ไม่พบคอร์สที่ต้องการปิด",
      });
    }

    if (String(course.status || "").trim().toLowerCase() !== "published") {
      return res.status(400).json({
        success: false,
        message: "course is not published - คอร์สต้องอยู่สถานะ published เท่านั้นจึงปิดได้",
      });
    }

    const updated = await prisma.course.update({
      where: { id },
      data: { status: "archived" },
    });

    return res.json({
      success: true,
      message: "ปิดคอร์สสำเร็จ",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการปิดคอร์ส",
      error: error.message,
    });
  }
};
