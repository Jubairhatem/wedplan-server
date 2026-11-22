const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const requireRole = require("../middlewares/requireRole");
const checkBlocked = require("../middlewares/checkBlocked");
const {
  createService,
  getMyServices,
  updateService,
  deleteService,
} = require("../controllers/vendor");

const router = express.Router();

// All vendor routes require JWT + vendor role + active unblocked status
router.use(verifyJWT, requireRole("vendor"), checkBlocked);

router.post("/services", createService);
router.get("/services", getMyServices);
router.patch("/services/:id", updateService);
router.delete("/services/:id", deleteService);

module.exports = router;
