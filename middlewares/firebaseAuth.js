import admin from "../config/firebaseAdmin.js";
import User from "../models/User.js";

const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const user = await User.findOne({
      firebaseUid: decodedToken.uid,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found in MongoDB",
      });
    }

    req.firebaseUser = decodedToken;
    req.user = user;

    next();
  } catch (error) {
    console.error("firebaseAuth error:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default firebaseAuth;