const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

/**
 * Middleware to check if user is blocked in the database
 * Also synchronizes the latest role from DB to prevent token privilege escalation
 */
async function checkBlocked(req, res, next) {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Authentication required",
    });
  }

  try {
    const db = getDB();
    const userCollection = db.collection("user");

    // Better Auth can store _id as ObjectId or as string id
    let user = null;
    if (ObjectId.isValid(req.user.userId)) {
      user = await userCollection.findOne({
        $or: [{ _id: new ObjectId(req.user.userId) }, { id: req.user.userId }],
      });
    } else {
      user = await userCollection.findOne({
        $or: [{ id: req.user.userId }, { email: req.user.email }],
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found. Please log in again.",
      });
    }

    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    // Re-verify and sync latest role from database
    req.user.role = user.role || "customer";
    req.user.subscriptionPlan = user.subscriptionPlan || "free";
    req.user.subscriptionExpiresAt = user.subscriptionExpiresAt || null;
    req.userDoc = user;

    next();
  } catch (error) {
    console.error("Error in checkBlocked middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify user account status",
    });
  }
}

module.exports = checkBlocked;
