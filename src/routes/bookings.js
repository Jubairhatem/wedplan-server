const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const { createBooking } = require("../controllers/bookings");
const {
  getMyBookings,
  cancelBooking,
  getBookingById,
} = require("../controllers/customerBookings");

const router = express.Router();

// Every booking route requires a valid, unblocked session
router.use(verifyJWT, checkBlocked);

// Customer booking management
router.post("/", requireRole("customer"), createBooking);
router.get("/my", requireRole("customer"), getMyBookings);
router.patch("/:id/cancel", requireRole("customer"), cancelBooking);

// Shared detail view (ownership enforced inside the controller)
router.get("/:id", getBookingById);

module.exports = router;
