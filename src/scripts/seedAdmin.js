const { MongoClient } = require("mongodb");
const env = require("../config/env");

async function seedAdmin() {
  if (!env.ADMIN_EMAIL) {
    console.error("❌ ADMIN_EMAIL is not set in environment variables");
    process.exit(1);
  }

  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.DB_NAME);
    const userCollection = db.collection("user");

    const existingAdmin = await userCollection.findOne({
      email: env.ADMIN_EMAIL.toLowerCase().trim(),
    });

    if (existingAdmin) {
      await userCollection.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            role: "admin",
            isBlocked: false,
            updatedAt: new Date(),
          },
        }
      );
      console.log(`✅ Existing user [${env.ADMIN_EMAIL}] promoted to admin role.`);
    } else {
      const now = new Date();
      const newAdmin = {
        name: "Admin User",
        email: env.ADMIN_EMAIL.toLowerCase().trim(),
        emailVerified: true,
        role: "admin",
        isBlocked: false,
        subscriptionPlan: "free",
        createdAt: now,
        updatedAt: now,
      };

      const result = await userCollection.insertOne(newAdmin);
      console.log(
        `✅ Admin user created with ID: ${result.insertedId} and email: ${env.ADMIN_EMAIL}`
      );
    }
  } catch (error) {
    console.error("❌ Admin seed failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedAdmin();
