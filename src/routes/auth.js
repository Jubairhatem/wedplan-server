const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const checkBlocked = require("../middlewares/checkBlocked");
const validate = require("../middlewares/validate");
const { updateProfileSchema } = require("../validators/users");
const { getUsersCollection } = require("../config/db");
const { isVendorPremium } = require("../controllers/vendor");

const router = express.Router();

/**
 * Removes internal/sensitive fields before sending a user to the client.
 * An expired premium plan is reported as `free` (the stored plan is left
 * untouched so payment history stays auditable).
 */
function sanitizeUser(user) {
  const isPremium = isVendorPremium(user);

  return {
    id: user.id || user._id,
    name: user.name || "",
    email: user.email,
    image: user.image || null,
    role: user.role || "customer",
    isBlocked: user.isBlocked || false,
    businessName: user.businessName || null,
    subscriptionPlan: isPremium ? "premium" : "free",
    subscriptionExpiresAt: isPremium ? user.subscriptionExpiresAt || null : null,
    createdAt: user.createdAt,
  };
}

/**
 * GET /api/users/me
 * Retrieves current authenticated user profile
 */
router.get("/me", verifyJWT, checkBlocked, (req, res) => {
  res.json({
    success: true,
    data: sanitizeUser(req.userDoc),
  });
});

/**
 * PATCH /api/users/me
 * Safe profile update: only name, image and businessName are writable.
 * Role, subscription and block status can never be changed here.
 */
router.patch(
  "/me",
  verifyJWT,
  checkBlocked,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const { name, image, businessName } = req.body;
      const updates = { updatedAt: new Date() };

      if (name !== undefined) updates.name = name.trim();
      if (image !== undefined) updates.image = image || null;
      if (businessName !== undefined) {
        updates.businessName = businessName.trim() || null;
      }

      const users = getUsersCollection();
      await users.updateOne({ _id: req.userDoc._id }, { $set: updates });

      const updated = await users.findOne({ _id: req.userDoc._id });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: sanitizeUser(updated),
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
