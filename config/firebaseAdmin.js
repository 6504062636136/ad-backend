import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./config/serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;