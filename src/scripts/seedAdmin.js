const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("node:crypto");
const env = require("../config/env");

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(salt + ":" + derivedKey.toString("hex"));
      }
    );
  });
}

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
    const accountCollection = db.collection("account");

    const email = env.ADMIN_EMAIL.toLowerCase().trim();
    let adminUser = await userCollection.findOne({ email });

    const now = new Date();

    if (adminUser) {
      await userCollection.updateOne(
        { _id: adminUser._id },
        {
          $set: {
            role: "admin",
            isBlocked: false,
            updatedAt: now,
          },
        }
      );
      console.log(`✅ Existing user [${email}] confirmed with admin role.`);
    } else {
      const newAdmin = {
        name: "Admin User",
        email,
        emailVerified: true,
        role: "admin",
        isBlocked: false,
        subscriptionPlan: "free",
        createdAt: now,
        updatedAt: now,
      };

      const result = await userCollection.insertOne(newAdmin);
      adminUser = { ...newAdmin, _id: result.insertedId };
      console.log(
        `✅ Admin user created with ID: ${result.insertedId} and email: ${email}`
      );
    }

    // Ensure password account exists for Better Auth
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!@#";
    const hashedPassword = await hashPassword(adminPassword);

    await accountCollection.deleteMany({
      $or: [
        { userId: adminUser._id },
        { userId: adminUser._id.toString() },
        { accountId: adminUser._id.toString() },
      ],
    });

    await accountCollection.insertOne({
      userId: adminUser._id,
      accountId: adminUser._id.toString(),
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    console.log(
      `✅ Admin credentials configured for [${email}] with password [${adminPassword}].`
    );
  } catch (error) {
    console.error("❌ Admin seed failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedAdmin();
