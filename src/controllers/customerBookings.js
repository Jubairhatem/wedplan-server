const { ObjectId } = require("mongodb");
const { getBookingsCollection } = require("../config/db");
const { toIdString, enrichBookings } = require("../utils/bookings");

/**
 * GET /api/bookings/my
 * Customer's own bookings with service + vendor details
 */
async function getMyBookings(req, res, next) {
  try {
    const bookings = getBookingsCollection();
    const customerId = toIdString(req.user.userId);

    const items = await bookings
      .find({ customerId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: await enrichBookings(items),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/bookings/:id/cancel
 * Customers can cancel only their own pending bookings
 */
async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const bookings = getBookingsCollection();
    const customerId = toIdString(req.user.userId);

    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (toIdString(booking.customerId) !== customerId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking",
      });
    }

    if (booking.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending bookings can be cancelled",
      });
    }

    await bookings.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bookings/:id
 * Accessible to the booking's customer or its vendor only
 */
async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const bookings = getBookingsCollection();
    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const userId = toIdString(req.user.userId);
    const isCustomer = toIdString(booking.customerId) === userId;
    const isVendor = toIdString(booking.vendorId) === userId;

    if (!isCustomer && !isVendor) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this booking",
      });
    }

    const [enriched] = await enrichBookings([booking], {
      includeCustomer: isVendor,
    });

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/customer/overview
 * Aggregated booking statistics for the customer dashboard
 */
async function getCustomerOverview(req, res, next) {
  try {
    const bookings = getBookingsCollection();
    const customerId = toIdString(req.user.userId);

    const [total, pending, accepted, rejected, cancelled] = await Promise.all([
      bookings.countDocuments({ customerId }),
      bookings.countDocuments({ customerId, status: "pending" }),
      bookings.countDocuments({ customerId, status: "accepted" }),
      bookings.countDocuments({ customerId, status: "rejected" }),
      bookings.countDocuments({ customerId, status: "cancelled" }),
    ]);

    res.json({
      success: true,
      data: { total, pending, accepted, rejected, cancelled },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyBookings,
  cancelBooking,
  getBookingById,
  getCustomerOverview,
};
