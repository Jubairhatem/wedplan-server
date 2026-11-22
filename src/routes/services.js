const express = require("express");
const {
  getServices,
  getFeaturedServices,
  getCategories,
  getServiceById,
} = require("../controllers/services");

const router = express.Router();

router.get("/featured", getFeaturedServices);
router.get("/categories", getCategories);
router.get("/:id", getServiceById);
router.get("/", getServices);

module.exports = router;
