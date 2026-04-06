import crypto from "crypto";
import path from "path";
import admin from "../config/firebaseAdmin.js";

const getBucketName = () => String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();

const getBucket = () => {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error(
      "FIREBASE_STORAGE_BUCKET is required to upload to Firebase Storage"
    );
  }
  return admin.storage().bucket(bucketName);
};

const guessExtensionFromMime = (mimetype = "") => {
  const map = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  return map[mimetype] || "";
};

const sanitizeBasename = (filename = "") => {
  const safe = String(filename || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9-_\.]/g, "_");

  return safe || "file";
};

const buildObjectPath = ({ destinationFolder, mimetype, originalFilename }) => {
  const folder = String(destinationFolder || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  const extFromName = path.extname(originalFilename || "");
  const ext = extFromName || guessExtensionFromMime(mimetype) || "";
  const baseNoExt = sanitizeBasename(
    extFromName ? path.basename(originalFilename || "", extFromName) : originalFilename
  );

  const random = crypto.randomBytes(6).toString("hex");
  const finalName = `${Date.now()}-${random}-${baseNoExt}${ext}`;
  return folder ? `${folder}/${finalName}` : finalName;
};

export const isFirebaseStorageUrl = (url = "") => {
  const value = String(url || "");
  return (
    value.includes("firebasestorage.googleapis.com") ||
    value.includes("storage.googleapis.com")
  );
};

export const extractFirebaseStoragePath = (url = "") => {
  const value = String(url || "");

  // Firebase download URL style:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media&token=...
  const firebaseMatch = value.match(/\/o\/([^?]+)/);
  if (firebaseMatch?.[1]) {
    try {
      return decodeURIComponent(firebaseMatch[1]);
    } catch {
      return firebaseMatch[1];
    }
  }

  // Google Cloud Storage URL style:
  // https://storage.googleapis.com/<bucket>/<path>
  const gcsMatch = value.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/);
  if (gcsMatch?.[1]) {
    return gcsMatch[1];
  }

  return "";
};

export const uploadBufferToFirebaseStorage = async ({
  buffer,
  destinationFolder,
  mimetype,
  originalFilename,
}) => {
  if (!buffer) {
    throw new Error("Missing file buffer");
  }

  const bucket = getBucket();
  const bucketName = getBucketName();
  const objectPath = buildObjectPath({
    destinationFolder,
    mimetype,
    originalFilename,
  });

  const token = crypto.randomUUID();
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimetype || undefined,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;

  return {
    url: downloadUrl,
    storagePath: objectPath,
  };
};

export const deleteFirebaseFileByPath = async (storagePath = "") => {
  const objectPath = String(storagePath || "").trim().replace(/^\/+/, "");
  if (!objectPath) return;

  const bucket = getBucket();
  const file = bucket.file(objectPath);

  try {
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    if (error?.code === 404) return;
    throw error;
  }
};

export const deleteFirebaseFileByUrl = async (url = "") => {
  if (!isFirebaseStorageUrl(url)) return;

  const storagePath = extractFirebaseStoragePath(url);
  if (!storagePath) return;

  await deleteFirebaseFileByPath(storagePath);
};

