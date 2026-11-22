const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const { getCustomerOverview } = require("../controllers/customerBookings");

const router = express.Router();

// Customer-only dashboard statistics
router.use(verifyJWT, checkBlocked, requireRole("customer"));
router.get("/overview", getCustomerOverview);

module.exports = router;
