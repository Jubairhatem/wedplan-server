const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const checkBlocked = require("../middlewares/checkBlocked");

const router = express.Router();

/**
 * GET /api/users/me
 * Retrieves current authenticated user profile
 */
router.get("/me", verifyJWT, checkBlocked, (req, res) => {
  const user = req.userDoc;

  // Sanitize user object
  const safeUser = {
    id: user.id || user._id,
    name: user.name || "",
    email: user.email,
    image: user.image || null,
    role: user.role || "customer",
    isBlocked: user.isBlocked || false,
    businessName: user.businessName || null,
    subscriptionPlan: user.subscriptionPlan || "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    createdAt: user.createdAt,
  };

  res.json({
    success: true,
    data: safeUser,
  });
});

module.exports = router;
