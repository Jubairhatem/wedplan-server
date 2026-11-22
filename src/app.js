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

// ----- Routes will be mounted here in later phases -----

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler (placeholder — full version in Phase 2)
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
