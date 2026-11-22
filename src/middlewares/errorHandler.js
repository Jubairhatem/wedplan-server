/**
 * Global centralized error handler middleware
 */
function errorHandler(err, req, res, _next) {
  console.error("❌ Application error:", err);

  // Default to 500 server error
  const status = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
