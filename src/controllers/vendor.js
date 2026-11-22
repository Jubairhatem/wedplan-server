const { ObjectId } = require("mongodb");
const { getServicesCollection, getBookingsCollection } = require("../config/db");
const { createServiceSchema, updateServiceSchema } = require("../validators/services");

/**
 * Helper to check if vendor has active premium plan
 */
function isVendorPremium(userDoc) {
  if (!userDoc || userDoc.subscriptionPlan !== "premium") {
    return false;
  }
  if (!userDoc.subscriptionExpiresAt) {
    return true; // lifetime / continuous
  }
  return new Date(userDoc.subscriptionExpiresAt) > new Date();
}

/**
 * POST /api/vendor/services
 * Create a new wedding service (default status: pending)
 * Enforces free-plan maximum of 3 active services
 */
async function createService(req, res, next) {
  try {
    const validatedData = createServiceSchema.parse(req.body);
    const services = getServicesCollection();
    const vendorId = req.user.userId;

    // Check vendor's subscription plan & active service limits
    const isPremium = isVendorPremium(req.userDoc);

    if (!isPremium && validatedData.isActive) {
      const activeCount = await services.countDocuments({
        vendorId: vendorId,
        isActive: true,
      });

      if (activeCount >= 3) {
        return res.status(403).json({
          success: false,
          message:
            "Free plan limit reached: You can have at most 3 active services. Please upgrade to Premium for unlimited listings.",
        });
      }
    }

    const now = new Date();
    const newService = {
      vendorId: vendorId,
      serviceName: validatedData.serviceName,
      category: validatedData.category,
      description: validatedData.description,
      price: Number(validatedData.price),
      location: validatedData.location,
      images: validatedData.images,
      status: "pending", // All new services require admin approval
      isActive: validatedData.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await services.insertOne(newService);

    res.status(201).json({
      success: true,
      message:
        "Service submitted successfully and is currently pending admin review.",
      data: {
        _id: result.insertedId,
        ...newService,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/vendor/services
 * Retrieve all services created by the current vendor
 */
async function getMyServices(req, res, next) {
  try {
    const services = getServicesCollection();
    const vendorId = req.user.userId;

    const myServices = await services
      .find({ vendorId: vendorId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: myServices,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/vendor/services/:id
 * Update an existing service with strict vendor ownership check
 */
async function updateService(req, res, next) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const validatedData = updateServiceSchema.parse(req.body);
    const services = getServicesCollection();
    const vendorId = req.user.userId;

    const existingService = await services.findOne({ _id: new ObjectId(id) });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Strict ownership verification
    if (existingService.vendorId.toString() !== vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to modify this service",
      });
    }

    // If activating service from inactive to active, re-check free limit
    const isActivating =
      validatedData.isActive === true && existingService.isActive === false;
    const isPremium = isVendorPremium(req.userDoc);

    if (isActivating && !isPremium) {
      const activeCount = await services.countDocuments({
        vendorId: vendorId,
        isActive: true,
      });

      if (activeCount >= 3) {
        return res.status(403).json({
          success: false,
          message:
            "Free plan limit reached: You can only maintain 3 active services simultaneously. Upgrade to Premium for unlimited listings.",
        });
      }
    }

    const updateFields = {
      ...validatedData,
      updatedAt: new Date(),
    };

    // Ensure vendor cannot arbitrarily approve their own service
    delete updateFields.status;
    delete updateFields.vendorId;

    await services.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updated = await services.findOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: "Service updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/vendor/services/:id
 * Delete a service with strict ownership verification
 */
async function deleteService(req, res, next) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const services = getServicesCollection();
    const vendorId = req.user.userId;

    const existingService = await services.findOne({ _id: new ObjectId(id) });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (existingService.vendorId.toString() !== vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this service",
      });
    }

    await services.deleteOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createService,
  getMyServices,
  updateService,
  deleteService,
  isVendorPremium,
};
