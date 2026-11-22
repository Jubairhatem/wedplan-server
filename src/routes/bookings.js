const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const { createBooking } = require("../controllers/bookings");

const router = express.Router();

// Every booking route requires a valid, unblocked session
router.use(verifyJWT, checkBlocked);

// Customer booking creation
router.post("/", requireRole("customer"), createBooking);

module.exports = router;
