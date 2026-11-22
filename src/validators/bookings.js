const { z } = require("zod");

const createBookingSchema = z.object({
  serviceId: z
    .string({ required_error: "Service ID is required" })
    .min(1, "Service ID is required"),
  eventDate: z.coerce.date({
    required_error: "Event date is required",
    invalid_type_error: "Please provide a valid event date",
  }),
  eventLocation: z
    .string({ required_error: "Event location is required" })
    .min(2, "Event location must be at least 2 characters")
    .max(200, "Event location cannot exceed 200 characters"),
  message: z
    .string()
    .max(1000, "Message cannot exceed 1000 characters")
    .optional()
    .or(z.literal("")),
});

module.exports = {
  createBookingSchema,
};
