const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const validate = require("../middlewares/validate");
const {
  getAdminOverview,
  getAdminUsers,
  getAdminUserById,
  toggleBlockStatus,
  getAdminServices,
  updateServiceStatus,
  deleteAdminService,
  getAdminTransactions,
} = require("../controllers/admin");

const router = express.Router();

// All admin routes require JWT + admin role + active unblocked status
router.use(verifyJWT, requireRole("admin"), checkBlocked);

// Overview
router.get("/overview", getAdminOverview);

// Users
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);
router.patch("/users/:id/block", toggleBlockStatus);
router.patch("/users/:id/unblock", toggleBlockStatus);

// Services (moderation)
router.get("/services", getAdminServices);
router.patch("/services/:id/status", updateServiceStatus);
router.delete("/services/:id", deleteAdminService);

// Transactions (read-only)
router.get("/transactions", getAdminTransactions);

module.exports = router;
