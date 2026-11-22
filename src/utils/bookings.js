const { ObjectId } = require("mongodb");
const { getServicesCollection, getUsersCollection } = require("../config/db");

/**
 * Normalizes an ObjectId or string id to a comparable string
 */
function toIdString(value) {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * UTC midnight of today, used to reject past event dates reliably
 */
function startOfTodayUTC() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function summarizeService(service) {
  if (!service) return null;
  return {
    _id: service._id,
    serviceName: service.serviceName,
    category: service.category,
    price: service.price,
    location: service.location,
    images: service.images || [],
  };
}

function summarizeVendor(vendor) {
  if (!vendor) return null;
  return {
    id: vendor.id || vendor._id,
    name: vendor.name,
    businessName: vendor.businessName || vendor.name,
    image: vendor.image || null,
    email: vendor.email,
  };
}

function summarizeCustomer(customer) {
  if (!customer) return null;
  return {
    id: customer.id || customer._id,
    name: customer.name,
    email: customer.email,
    image: customer.image || null,
  };
}

/**
 * Batch-enriches booking documents with related service, vendor and (optionally)
 * customer details. Avoids N+1 queries when listing bookings.
 */
async function enrichBookings(bookings, { includeCustomer = false } = {}) {
  if (!bookings.length) return [];

  const services = getServicesCollection();
  const users = getUsersCollection();

  const serviceIds = [
    ...new Set(
      bookings
        .map((booking) => booking.serviceId)
        .filter((id) => ObjectId.isValid(id))
    ),
  ].map((id) => new ObjectId(id));

  const vendorIds = [...new Set(bookings.map((b) => toIdString(b.vendorId)))]
    .filter(Boolean);

  const serviceQuery = serviceIds.length
    ? services.find({ _id: { $in: serviceIds } }).toArray()
    : Promise.resolve([]);

  const vendorObjectIds = vendorIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const vendorStringIds = vendorIds.filter((id) => !ObjectId.isValid(id));

  const vendorLookups = [];
  if (vendorStringIds.length) {
    vendorLookups.push({ id: { $in: vendorStringIds } });
  }
  if (vendorObjectIds.length) {
    vendorLookups.push({ _id: { $in: vendorObjectIds } });
  }

  const customerIds = includeCustomer
    ? [...new Set(bookings.map((b) => toIdString(b.customerId)))].filter(Boolean)
    : [];

  const customerObjectIds = customerIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const customerStringIds = customerIds.filter((id) => !ObjectId.isValid(id));

  const customerLookups = [];
  if (customerStringIds.length) {
    customerLookups.push({ id: { $in: customerStringIds } });
  }
  if (customerObjectIds.length) {
    customerLookups.push({ _id: { $in: customerObjectIds } });
  }

  const [serviceDocs, vendorDocs, customerDocs] = await Promise.all([
    serviceQuery,
    vendorLookups.length
      ? users.find({ $or: vendorLookups }).toArray()
      : Promise.resolve([]),
    includeCustomer && customerLookups.length
      ? users.find({ $or: customerLookups }).toArray()
      : Promise.resolve([]),
  ]);

  const serviceMap = new Map(
    serviceDocs.map((service) => [String(service._id), service])
  );

  const vendorMap = new Map();
  for (const vendor of vendorDocs) {
    vendorMap.set(String(vendor.id || vendor._id), vendor);
    vendorMap.set(String(vendor._id), vendor);
  }

  const customerMap = new Map();
  for (const customer of customerDocs) {
    customerMap.set(String(customer.id || customer._id), customer);
    customerMap.set(String(customer._id), customer);
  }

  return bookings.map((booking) => ({
    ...booking,
    service: summarizeService(serviceMap.get(toIdString(booking.serviceId))),
    vendor: summarizeVendor(vendorMap.get(toIdString(booking.vendorId))),
    ...(includeCustomer && {
      customer: summarizeCustomer(
        customerMap.get(toIdString(booking.customerId))
      ),
    }),
  }));
}

module.exports = {
  toIdString,
  startOfTodayUTC,
  summarizeService,
  summarizeVendor,
  summarizeCustomer,
  enrichBookings,
};
