const env = require("../config/env");
const {
  stripe,
  isStripeConfigured,
  PREMIUM_PRICE_ID,
} = require("../config/stripe");
const { getTransactionsCollection } = require("../config/db");
const { isVendorPremium } = require("./vendor");
const { toIdString } = require("../utils/bookings");

/**
 * Reads the unit amount of the configured premium price so we can store an
 * immutable record of what the vendor was charged.
 */
async function resolvePremiumPrice() {
  if (!PREMIUM_PRICE_ID) {
    return { amount: 0, currency: "usd" };
  }

  try {
    const price = await stripe.prices.retrieve(PREMIUM_PRICE_ID);
    return {
      amount: price.unit_amount ?? 0,
      currency: price.currency || "usd",
    };
  } catch (error) {
    console.error("Unable to retrieve the premium price:", error.message);
    return { amount: 0, currency: "usd" };
  }
}

/**
 * POST /api/payments/create-checkout-session
 * Vendor-only. The vendor identity ALWAYS comes from the verified JWT, so a
 * vendor can never create a checkout session for somebody else.
 */
async function createCheckoutSession(req, res, next) {
  try {
    if (!isStripeConfigured || !PREMIUM_PRICE_ID) {
      return res.status(503).json({
        success: false,
        message:
          "Premium subscriptions are not configured yet. Please contact support.",
      });
    }

    const vendorId = toIdString(req.user.userId);

    if (isVendorPremium(req.userDoc)) {
      return res.status(409).json({
        success: false,
        message: "You already have an active Premium subscription",
      });
    }

    const { amount, currency } = await resolvePremiumPrice();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PREMIUM_PRICE_ID, quantity: 1 }],
      customer_email: req.userDoc?.email || req.user.email,
      client_reference_id: vendorId,
      // vendorId is bound server-side and reused by the webhook
      metadata: { vendorId, purpose: "premium_subscription" },
      subscription_data: {
        metadata: { vendorId, purpose: "premium_subscription" },
      },
      success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/payment/cancel`,
      allow_promotion_codes: true,
    });

    const transactions = getTransactionsCollection();
    const now = new Date();

    await transactions.insertOne({
      vendorId,
      plan: "premium",
      amount,
      currency,
      status: "pending",
      stripeSessionId: session.id,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      success: true,
      message: "Checkout session created",
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/payments/session/:id
 * Read-only confirmation endpoint for the success page. It NEVER activates
 * premium — activation only happens through the verified Stripe webhook.
 */
async function getCheckoutSession(req, res, next) {
  try {
    const { id } = req.params;

    const transactions = getTransactionsCollection();
    const vendorId = toIdString(req.user.userId);

    const transaction = await transactions.findOne({
      stripeSessionId: id,
      vendorId,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Payment session not found",
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: transaction.stripeSessionId,
        status: transaction.status,
        plan: transaction.plan,
        amount: transaction.amount,
        currency: transaction.currency,
        isPremium: isVendorPremium(req.userDoc),
        expiresAt: req.userDoc?.subscriptionExpiresAt || null,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCheckoutSession,
  getCheckoutSession,
};
