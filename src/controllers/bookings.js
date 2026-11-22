const { ObjectId } = require("mongodb");
const {
  getServicesCollection,
  getBookingsCollection,
} = require("../config/db");
const { createBookingSchema } = require("../validators/bookings");
const { toIdString, startOfTodayUTC } = require("../utils/bookings");

/**
 * POST /api/bookings
 * Customer-only booking creation with strict server-side validation
 */
async function createBooking(req, res, next) {
  try {
    const { serviceId, eventDate, eventLocation, message } =
      createBookingSchema.parse(req.body);

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const services = getServicesCollection();
    const bookings = getBookingsCollection();
    const customerId = toIdString(req.user.userId);

    const service = await services.findOne({ _id: new ObjectId(serviceId) });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Wedding service not found",
      });
    }

    if (service.status !== "approved" || service.isActive !== true) {
      return res.status(400).json({
        success: false,
        message: "This service is not currently available for booking",
      });
    }

    // A vendor cannot book their own service
    if (toIdString(service.vendorId) === customerId) {
      return res.status(403).json({
        success: false,
        message: "You cannot book your own service",
      });
    }

    // Event date must not be in the past
    if (eventDate < startOfTodayUTC()) {
      return res.status(400).json({
        success: false,
        message: "Event date cannot be in the past",
      });
    }

    // Prevent duplicate active bookings for the same service + date
    const duplicate = await bookings.findOne({
      serviceId: new ObjectId(serviceId),
      customerId,
      eventDate,
      status: { $in: ["pending", "accepted"] },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active booking for this service on the selected date",
      });
    }

    const booking = {
      serviceId: new ObjectId(serviceId),
      vendorId: service.vendorId,
      customerId,
      eventDate,
      eventLocation,
      message: message?.trim() ? message.trim() : null,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await bookings.insertOne(booking);

    res.status(201).json({
      success: true,
      message: "Booking request sent successfully",
      data: {
        _id: result.insertedId,
        ...booking,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBooking,
};
