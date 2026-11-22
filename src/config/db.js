const { MongoClient } = require("mongodb");
const env = require("./env");

let db;
let client;

// Collection references
let servicesCollection;
let bookingsCollection;
let transactionsCollection;

async function connectDB() {
  try {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    db = client.db(env.DB_NAME);

    // Initialize collection references
    servicesCollection = db.collection("services");
    bookingsCollection = db.collection("bookings");
    transactionsCollection = db.collection("transactions");

    // Create indexes
    await createIndexes();

    console.log(`✅ Connected to MongoDB — database: ${env.DB_NAME}`);
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
}

async function createIndexes() {
  // Unique index on transactions.stripeSessionId
  await transactionsCollection.createIndex(
    { stripeSessionId: 1 },
    { unique: true, sparse: true }
  );

  // Compound index on bookings to prevent duplicate active bookings
  await bookingsCollection.createIndex(
    { serviceId: 1, customerId: 1, eventDate: 1 }
  );

  // Index on services for status + isActive filtering
  await servicesCollection.createIndex({ status: 1, isActive: 1 });

  // Text index on serviceName for search
  await servicesCollection.createIndex({ serviceName: "text" });

  console.log("✅ Database indexes created");
}

function getDB() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() first.");
  }
  return db;
}

function getServicesCollection() {
  return servicesCollection;
}

function getBookingsCollection() {
  return bookingsCollection;
}

function getTransactionsCollection() {
  return transactionsCollection;
}

function getClient() {
  return client;
}

module.exports = {
  connectDB,
  getDB,
  getClient,
  getServicesCollection,
  getBookingsCollection,
  getTransactionsCollection,
};
