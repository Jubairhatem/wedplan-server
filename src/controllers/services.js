const { ObjectId } = require("mongodb");
const { getServicesCollection, getUsersCollection } = require("../config/db");

/**
 * Shapes a vendor document into the public-safe summary used by service cards
 */
function summarizeVendor(vendor) {
  if (!vendor) return null;
  return {
    id: vendor.id || vendor._id,
    name: vendor.name,
    businessName: vendor.businessName || vendor.name,
    image: vendor.image || null,
    isPremium: vendor.subscriptionPlan === "premium",
  };
}

/**
 * Attaches a lightweight vendor summary to each service using a single batched query
 * (avoids N+1 lookups when rendering public listings)
 */
async function attachVendors(services) {
  if (!services.length) return services;

  const vendorIds = [
    ...new Set(services.map((s) => s.vendorId).filter(Boolean)),
  ];
  if (!vendorIds.length) {
    return services.map((s) => ({ ...s, vendor: null }));
  }

  const users = getUsersCollection();
  const objectIds = vendorIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const stringIds = vendorIds.filter((id) => !ObjectId.isValid(id));

  const lookups = [];
  if (objectIds.length) lookups.push({ _id: { $in: objectIds } });
  if (stringIds.length) lookups.push({ id: { $in: stringIds } });

  const vendors = lookups.length
    ? await users.find({ $or: lookups }).toArray()
    : [];

  const vendorMap = new Map();
  for (const vendor of vendors) {
    vendorMap.set(String(vendor.id || vendor._id), vendor);
    vendorMap.set(String(vendor._id), vendor);
  }

  return services.map((service) => ({
    ...service,
    vendor: summarizeVendor(vendorMap.get(String(service.vendorId))),
  }));
}

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
    const rawItems = await services
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const items = await attachVendors(rawItems);

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
      data: await attachVendors(items),
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
    // Public detail endpoint only exposes approved + active services
    const service = await services.findOne({
      _id: new ObjectId(id),
      status: "approved",
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Wedding service not found",
      });
    }

    const [enriched] = await attachVendors([service]);

    res.json({
      success: true,
      data: enriched,
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
