const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const {
  createCheckoutSession,
  getCheckoutSession,
} = require("../controllers/payments");

const router = express.Router();

// Premium subscriptions are sold to vendors only
router.use(verifyJWT, requireRole("vendor"), checkBlocked);

router.post("/create-checkout-session", createCheckoutSession);
router.get("/session/:id", getCheckoutSession);

module.exports = router;
