/**
 * Middleware factory to enforce role-based access control
 * @param  {...string} roles Allowed roles ('admin', 'vendor', 'customer')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${roles.join(", ")}] roles only`,
      });
    }

    next();
  };
}

module.exports = requireRole;
