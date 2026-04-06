import admin from "firebase-admin";
import "firebase-admin/auth";
import "firebase-admin/storage";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./config/serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });
}

export default admin;
