const { ZodError } = require("zod");

/**
 * Middleware factory for validating request data against a Zod schema
 * @param {import("zod").ZodSchema} schema
 * @param {"body" | "query" | "params"} [source="body"]
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = {};
        const issues = error.issues || error.errors || [];
        issues.forEach((err) => {
          const field = err.path.join(".");
          if (!formattedErrors[field]) {
            formattedErrors[field] = [];
          }
          formattedErrors[field].push(err.message);
        });
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: formattedErrors,
        });
      }
      next(error);
    }
  };
}

module.exports = validate;
