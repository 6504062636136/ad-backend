import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("รองรับเฉพาะไฟล์รูป png, jpg, jpeg, webp"));
  }

  cb(null, true);
};

const uploadCourseThumbnail = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadCourseThumbnail;
