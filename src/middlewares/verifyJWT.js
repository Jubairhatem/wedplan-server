const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Middleware to verify JWT bearer token
 * Attaches { userId, email, role } to req.user
 */
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token is missing or malformed",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      userId: decoded.userId || decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role || "customer",
    };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please sign in again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid or malformed token",
    });
  }
}

module.exports = verifyJWT;
