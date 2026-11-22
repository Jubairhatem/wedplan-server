const { ObjectId } = require("mongodb");
const { getServicesCollection, getUsersCollection } = require("../config/db");

/**
 * GET /api/services
 * Public browse endpoint with search, category, location filter, price sorting and pagination
 */
async function getServices(req, res, next) {
  try {
    const services = getServicesCollection();

    const {
      search,
      category,
      location,
      sort,
      page = 1,
      limit = 9,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 9));
    const skip = (pageNum - 1) * limitNum;

    // Build filter query: only approved and active services are public
    const query = {
      status: "approved",
      isActive: true,
    };

    if (search && search.trim() !== "") {
      query.$or = [
        { serviceName: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { location: { $regex: search.trim(), $options: "i" } },
      ];
    }

    if (category && category.trim() !== "") {
      query.category = category.trim();
    }

    if (location && location.trim() !== "") {
      query.location = { $regex: location.trim(), $options: "i" };
    }

    // Determine sort order
    let sortOptions = { createdAt: -1 }; // default: newest
    if (sort === "price_asc") {
      sortOptions = { price: 1 };
    } else if (sort === "price_desc") {
      sortOptions = { price: -1 };
    } else if (sort === "oldest") {
      sortOptions = { createdAt: 1 };
    }

    const total = await services.countDocuments(query);
    const items = await services
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .toArray();

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
 * GET /api/services/featured
 * Returns at least 6 approved and active services for the homepage
 */
async function getFeaturedServices(req, res, next) {
  try {
    const services = getServicesCollection();

    const items = await services
      .find({ status: "approved", isActive: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/services/categories
 * Returns category list with item counts
 */
async function getCategories(req, res, next) {
  try {
    const services = getServicesCollection();

    const categories = [
      "Photography & Videography",
      "Wedding Venues",
      "Decoration & Florist",
      "Catering Services",
      "Makeup & Styling",
      "Wedding Fashion",
    ];

    const counts = await services
      .aggregate([
        { $match: { status: "approved", isActive: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = counts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const result = categories.map((cat) => ({
      name: cat,
      count: countMap[cat] || 0,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/services/:id
 * Retrieves single service details with vendor info
 */
async function getServiceById(req, res, next) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID format",
      });
    }

    const services = getServicesCollection();
    const service = await services.findOne({ _id: new ObjectId(id) });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Wedding service not found",
      });
    }

    // Attach vendor information if available
    const users = getUsersCollection();
    let vendor = null;

    if (service.vendorId) {
      if (ObjectId.isValid(service.vendorId)) {
        vendor = await users.findOne({ _id: new ObjectId(service.vendorId) });
      } else {
        vendor = await users.findOne({
          $or: [{ id: service.vendorId }, { email: service.vendorId }],
        });
      }
    }

    const responseData = {
      ...service,
      vendor: vendor
        ? {
            id: vendor.id || vendor._id,
            name: vendor.name,
            businessName: vendor.businessName || vendor.name,
            image: vendor.image,
            email: vendor.email,
            isPremium: vendor.subscriptionPlan === "premium",
          }
        : null,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getServices,
  getFeaturedServices,
  getCategories,
  getServiceById,
};
