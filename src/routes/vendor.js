const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const {
  createService,
  getMyServices,
  updateService,
  deleteService,
  getVendorOverview,
} = require("../controllers/vendor");
const {
  getVendorBookings,
  acceptBooking,
  rejectBooking,
} = require("../controllers/vendorBookings");

const router = express.Router();

// All vendor routes require JWT + vendor role + active unblocked status
router.use(verifyJWT, requireRole("vendor"), checkBlocked);

router.get("/overview", getVendorOverview);
router.post("/services", createService);
router.get("/services", getMyServices);
router.patch("/services/:id", updateService);
router.delete("/services/:id", deleteService);

// Booking requests
router.get("/bookings", getVendorBookings);
router.patch("/bookings/:id/accept", acceptBooking);
router.patch("/bookings/:id/reject", rejectBooking);

module.exports = router;
