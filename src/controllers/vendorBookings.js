const { ObjectId } = require("mongodb");
const { getBookingsCollection } = require("../config/db");
const { toIdString, enrichBookings } = require("../utils/bookings");

/**
 * GET /api/vendor/bookings
 * Booking requests received by the authenticated vendor
 */
async function getVendorBookings(req, res, next) {
  try {
    const bookings = getBookingsCollection();
    const vendorId = toIdString(req.user.userId);

    const items = await bookings
      .find({ vendorId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: await enrichBookings(items, { includeCustomer: true }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Shared accept/reject handler enforcing vendor ownership + pending-only rule
 */
async function updateBookingStatus(req, res, next, newStatus) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const bookings = getBookingsCollection();
    const vendorId = toIdString(req.user.userId);

    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (toIdString(booking.vendorId) !== vendorId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to manage this booking",
      });
    }

    if (booking.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `This booking has already been ${booking.status}`,
      });
    }

    await bookings.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: newStatus, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Booking ${newStatus} successfully`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/vendor/bookings/:id/accept
 */
function acceptBooking(req, res, next) {
  return updateBookingStatus(req, res, next, "accepted");
}

/**
 * PATCH /api/vendor/bookings/:id/reject
 */
function rejectBooking(req, res, next) {
  return updateBookingStatus(req, res, next, "rejected");
}

module.exports = {
  getVendorBookings,
  acceptBooking,
  rejectBooking,
};
