const express = require("express");
const { stripeWebhook } = require("../controllers/stripeWebhook");

const router = express.Router();

// Raw body is provided by express.raw() mounted in app.js before express.json()
router.post("/", stripeWebhook);

module.exports = router;
