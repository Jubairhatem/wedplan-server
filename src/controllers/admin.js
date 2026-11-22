const { ObjectId } = require("mongodb");
const {
  getServicesCollection,
  getBookingsCollection,
  getTransactionsCollection,
  getUsersCollection,
} = require("../config/db");

/**
 * Normalizes a MongoDB user document into a safe public admin view.
 * Never exposes sensitive internals beyond what an admin needs to moderate.
 */
function summarizeAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id || user._id,
    name: user.name || "",
    email: user.email,
    image: user.image || null,
    role: user.role || "customer",
    isBlocked: user.isBlocked === true,
    businessName: user.businessName || null,
    subscriptionPlan: user.subscriptionPlan || "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    createdAt: user.createdAt || null,
  };
}

/**
 * GET /api/admin/overview
 * Platform-wide statistics for the admin dashboard.
 */
async function getAdminOverview(req, res, next) {
  try {
    const users = getUsersCollection();
    const services = getServicesCollection();
    const transactions = getTransactionsCollection();
    const bookings = getBookingsCollection();

    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalServices,
      pendingServices,
      totalTransactions,
      totalBookings,
    ] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ role: "vendor" }),
      users.countDocuments({ role: "customer" }),
      services.countDocuments({}),
      services.countDocuments({ status: "pending" }),
      transactions.countDocuments({}),
      bookings.countDocuments({}),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        totalTransactions,
        totalBookings,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/users
 * Searchable, role-filtered, paginated user list.
 */
async function getAdminUsers(req, res, next) {
  try {
    const users = getUsersCollection();

    const { search, role, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (role && role.trim() !== "") {
      query.role = role.trim();
    }
    if (search && search.trim() !== "") {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const [total, items] = await Promise.all([
      users.countDocuments(query),
      users
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
    ]);

    res.json({
      success: true,
      data: items.map(summarizeAdminUser),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/users/:id
 * Single user details for the admin details modal.
 */
async function getAdminUserById(req, res, next) {
  try {
    const { id } = req.params;

    const users = getUsersCollection();
    let user = null;

    if (ObjectId.isValid(id)) {
      user = await users.findOne({
        $or: [{ _id: new ObjectId(id) }, { id }],
      });
    } else {
      user = await users.findOne({ id });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: summarizeAdminUser(user),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:id/block  |  /unblock
 * Blocks or unblocks a user. An admin cannot block themselves or another admin.
 */
async function toggleBlockStatus(req, res, next) {
  try {
    const { id } = req.params;
    // Action is derived from the matched route path (/block or /unblock),
    // not from query params, so the two routes share one handler safely.
    const action = req.path.endsWith("/block") ? "block" : "unblock";

    const users = getUsersCollection();

    let targetUser = null;
    if (ObjectId.isValid(id)) {
      targetUser = await users.findOne({
        $or: [{ _id: new ObjectId(id) }, { id }],
      });
    } else {
      targetUser = await users.findOne({ id });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentUserId = req.user.userId;
    const targetUserId = String(targetUser.id || targetUser._id);

    // Cannot block/unblock yourself
    if (String(currentUserId) === targetUserId) {
      return res.status(403).json({
        success: false,
        message: "You cannot block or unblock your own account",
      });
    }

    // Cannot block another admin
    if (
      action === "block" &&
      targetUser.role === "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot block another administrator",
      });
    }

    const isBlocking = action === "block";

    await users.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          isBlocked: isBlocking,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: `User ${isBlocking ? "blocked" : "unblocked"} successfully`,
      data: summarizeAdminUser({
        ...targetUser,
        isBlocked: isBlocking,
      }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/services
 * Searchable, status/category-filtered, paginated service list for moderation.
 */
async function getAdminServices(req, res, next) {
  try {
    const services = getServicesCollection();

    const { search, status, category, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (status && status.trim() !== "") {
      query.status = status.trim();
    }
    if (category && category.trim() !== "") {
      query.category = category.trim();
    }
    if (search && search.trim() !== "") {
      query.$or = [
        { serviceName: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { location: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const [total, items] = await Promise.all([
      services.countDocuments(query),
      services
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/services/:id/status
 * Approve, reject, or toggle active status of a service.
 */
async function updateServiceStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const validStatuses = ["pending", "approved", "rejected"];
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const services = getServicesCollection();
    const existingService = await services.findOne({ _id: new ObjectId(id) });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const updateFields = { updatedAt: new Date() };
    if (status !== undefined) updateFields.status = status;
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);

    await services.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updated = await services.findOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: "Service status updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/services/:id
 * Deletes a service (admin moderation).
 */
async function deleteAdminService(req, res, next) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const services = getServicesCollection();
    const existingService = await services.findOne({ _id: new ObjectId(id) });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
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

/**
 * GET /api/admin/transactions
 * Read-only transaction list with vendor info. No edit route exists by design.
 */
async function getAdminTransactions(req, res, next) {
  try {
    const transactions = getTransactionsCollection();
    const users = getUsersCollection();

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, items] = await Promise.all([
      transactions.countDocuments({}),
      transactions
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
    ]);

    // Enrich with vendor info
    const vendorIds = [
      ...new Set(items.map((t) => String(t.vendorId)).filter(Boolean)),
    ];
    const vendors = vendorIds.length
      ? await users
          .find({
            $or: [
              { id: { $in: vendorIds } },
              ...(vendorIds.some((v) => ObjectId.isValid(v))
                ? [{ _id: { $in: vendorIds.filter((v) => ObjectId.isValid(v)).map((v) => new ObjectId(v)) } }]
                : []),
            ],
          })
          .toArray()
      : [];

    const vendorMap = new Map();
    for (const vendor of vendors) {
      vendorMap.set(String(vendor.id || vendor._id), vendor);
      vendorMap.set(String(vendor._id), vendor);
    }

    const enriched = items.map((t) => {
      const vendor = vendorMap.get(String(t.vendorId));
      return {
        id: t.id || t._id,
        vendorId: t.vendorId,
        vendorName: vendor
          ? vendor.businessName || vendor.name || "Unknown Vendor"
          : "Unknown Vendor",
        plan: t.plan,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        stripeSessionId: t.stripeSessionId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminOverview,
  getAdminUsers,
  getAdminUserById,
  toggleBlockStatus,
  getAdminServices,
  updateServiceStatus,
  deleteAdminService,
  getAdminTransactions,
};
