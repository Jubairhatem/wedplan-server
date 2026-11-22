const { z } = require("zod");

const createServiceSchema = z.object({
  serviceName: z
    .string({ required_error: "Service name is required" })
    .min(3, "Service name must be at least 3 characters")
    .max(100, "Service name cannot exceed 100 characters"),
  category: z.enum(
    [
      "Photography & Videography",
      "Wedding Venues",
      "Decoration & Florist",
      "Catering Services",
      "Makeup & Styling",
      "Wedding Fashion",
    ],
    {
      required_error: "Please select a valid service category",
    }
  ),
  description: z
    .string({ required_error: "Description is required" })
    .min(20, "Description must be at least 20 characters")
    .max(3000, "Description cannot exceed 3000 characters"),
  price: z.coerce
    .number({ required_error: "Price is required" })
    .positive("Price must be a positive number"),
  location: z
    .string({ required_error: "Location is required" })
    .min(2, "Location must be at least 2 characters"),
  images: z
    .array(z.string().url("Each image must be a valid URL"))
    .min(1, "Please provide at least one service image")
    .max(10, "You can upload up to 10 images"),
  isActive: z.boolean().optional().default(true),
});

const updateServiceSchema = createServiceSchema.partial();

module.exports = {
  createServiceSchema,
  updateServiceSchema,
};
