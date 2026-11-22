const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const env = require("./config/env");

const app = express();

// Security headers
app.use(helmet());

// Request logging
app.use(morgan("dev"));

// CORS — allow only the client origin, with credentials
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Cookie parser
app.use(cookieParser());

// ⚠️ Stripe webhook needs raw body — mount BEFORE express.json()
app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" })
);
// JSON body parser for all other routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "WedPlan API is running 🎉",
    timestamp: new Date().toISOString(),
  });
});

// Auth / Users routes
const authRoutes = require("./routes/auth");
const servicesRoutes = require("./routes/services");
const vendorRoutes = require("./routes/vendor");
const bookingsRoutes = require("./routes/bookings");
const customerRoutes = require("./routes/customer");
const paymentsRoutes = require("./routes/payments");
const errorHandler = require("./middlewares/errorHandler");

app.use("/api/users", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/payments", paymentsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global centralized error handler
app.use(errorHandler);

module.exports = app;
