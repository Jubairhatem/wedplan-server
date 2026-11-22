const { z } = require("zod");

/**
 * Profile updates are strictly allow-listed.
 * Sensitive fields (role, subscriptionPlan, isBlocked, subscriptionExpiresAt)
 * are rejected outright by `.strict()`.
 */
const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name cannot exceed 80 characters")
      .optional(),
    image: z
      .union([z.string().url("Image must be a valid URL"), z.literal("")])
      .optional(),
    businessName: z
      .string()
      .trim()
      .max(120, "Business name cannot exceed 120 characters")
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

module.exports = {
  updateProfileSchema,
};
