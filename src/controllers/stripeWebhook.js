const {
  stripe,
  WEBHOOK_SECRET,
  isPlaceholder,
} = require("../config/stripe");
const {
  getTransactionsCollection,
  getUsersCollection,
} = require("../config/db");
const { toIdString } = require("../utils/bookings");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Stripe moved `current_period_end` from the subscription to its items in
 * recent API versions, so support both shapes.
 */
function resolvePeriodEnd(subscription) {
  if (!subscription) return null;

  const seconds =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end ??
    subscription.trial_end ??
    null;

  return seconds ? new Date(seconds * 1000) : null;
}

function subscriptionIdOf(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function customerIdOf(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

/**
 * Idempotently flips a transaction to `paid` and activates premium.
 * Returns true only when this call performed the transition.
 */
async function markTransactionPaid({ sessionId, vendorId, patch = {} }) {
  const transactions = getTransactionsCollection();
  const now = new Date();

  const filter = { stripeSessionId: sessionId, status: { $ne: "paid" } };
  const result = await transactions.updateOne(filter, {
    $set: { status: "paid", paidAt: now, updatedAt: now, ...patch },
  });

  if (result.modifiedCount === 0) {
    // Already processed — Stripe may deliver the same event more than once.
    return false;
  }

  const users = getUsersCollection();
  const userFilter = { id: vendorId };
  const user = await users.findOne(userFilter);

  if (!user) {
    console.warn(`Webhook: vendor ${vendorId} no longer exists`);
    return true;
  }

  const expiresAt = patch.subscriptionExpiresAt || new Date(Date.now() + THIRTY_DAYS_MS);

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
        ...(patch.stripeSubscriptionId
          ? { stripeSubscriptionId: patch.stripeSubscriptionId }
          : {}),
        ...(patch.stripeCustomerId
          ? { stripeCustomerId: patch.stripeCustomerId }
          : {}),
        updatedAt: now,
      },
    }
  );

  return true;
}

/**
 * checkout.session.completed → premium is activated
 */
async function handleCheckoutCompleted(session) {
  const vendorId = toIdString(
    session.metadata?.vendorId || session.client_reference_id
  );

  if (!vendorId) {
    console.warn("Webhook: checkout session without a vendorId");
    return;
  }

  const subscriptionId = subscriptionIdOf(session.subscription);
  let expiresAt = null;

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      expiresAt = resolvePeriodEnd(subscription);
    } catch (error) {
      console.warn(
        `Webhook: unable to read subscription ${subscriptionId}:`,
        error.message
      );
    }
  }

  const activated = await markTransactionPaid({
    sessionId: session.id,
    vendorId,
    patch: {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerIdOf(session.customer),
      amount: session.amount_total ?? undefined,
      currency: session.currency || undefined,
      ...(expiresAt ? { subscriptionExpiresAt: expiresAt } : {}),
    },
  });

  if (activated) {
    console.log(`✅ Premium activated for vendor ${vendorId}`);
  }
}

/**
 * invoice.payment_succeeded → extend the subscription expiry
 */
async function handleInvoicePaid(invoice) {
  const subscriptionId = subscriptionIdOf(invoice.subscription);

  if (!subscriptionId) {
    console.warn("Webhook: invoice without a subscription id");
    return;
  }

  const transactions = getTransactionsCollection();
  const transaction = await transactions.findOne({
    stripeSubscriptionId: subscriptionId,
  });

  if (!transaction) {
    console.warn(
      `Webhook: no transaction found for subscription ${subscriptionId}`
    );
    return;
  }

  const periodEndSeconds =
    invoice.lines?.data?.[0]?.period?.end ?? invoice.period_end ?? null;
  const newPeriodEnd = periodEndSeconds
    ? new Date(periodEndSeconds * 1000)
    : new Date(Date.now() + THIRTY_DAYS_MS);

  // Idempotency: never move the expiry backwards on a replayed invoice
  if (
    transaction.currentPeriodEnd &&
    new Date(transaction.currentPeriodEnd).getTime() >= newPeriodEnd.getTime()
  ) {
    return;
  }

  const users = getUsersCollection();
  const now = new Date();

  await transactions.updateOne(
    { _id: transaction._id },
    {
      $set: {
        status: "paid",
        currentPeriodEnd: newPeriodEnd,
        updatedAt: now,
      },
    }
  );

  const vendor = await users.findOne({ id: toIdString(transaction.vendorId) });
  if (!vendor) return;

  await users.updateOne(
    { _id: vendor._id },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: newPeriodEnd,
        updatedAt: now,
      },
    }
  );
}

/**
 * Reverts a vendor to the free plan. Used when a subscription is cancelled or
 * a checkout session expires.
 */
async function downgradeVendor(vendorId) {
  if (!vendorId) return;

  const users = getUsersCollection();
  const vendor = await users.findOne({ id: toIdString(vendorId) });

  if (!vendor) return;

  await users.updateOne(
    { _id: vendor._id },
    {
      $set: {
        subscriptionPlan: "free",
        subscriptionExpiresAt: null,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * invoice.payment_failed → the transaction is marked as failed.
 * A historical paid record is never overwritten, only annotated.
 */
async function handleInvoiceFailed(invoice) {
  const subscriptionId = subscriptionIdOf(invoice.subscription);

  if (!subscriptionId) {
    console.warn("Webhook: failed invoice without a subscription id");
    return;
  }

  const transactions = getTransactionsCollection();
  const now = new Date();

  const transaction = await transactions.findOne({
    stripeSubscriptionId: subscriptionId,
  });

  if (!transaction) {
    console.warn(
      `Webhook: no transaction found for subscription ${subscriptionId}`
    );
    return;
  }

  if (transaction.status === "paid") {
    await transactions.updateOne(
      { _id: transaction._id },
      { $set: { lastPaymentFailedAt: now, updatedAt: now } }
    );
    return;
  }

  await transactions.updateOne(
    { _id: transaction._id },
    { $set: { status: "failed", lastPaymentFailedAt: now, updatedAt: now } }
  );
}

/**
 * customer.subscription.deleted → downgrade the vendor to the free plan
 */
async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscriptionIdOf(subscription);
  const transactions = getTransactionsCollection();
  const now = new Date();

  let vendorId = toIdString(subscription?.metadata?.vendorId);

  if (subscriptionId) {
    const transaction = await transactions.findOne({
      stripeSubscriptionId: subscriptionId,
    });

    if (transaction) {
      vendorId = vendorId || toIdString(transaction.vendorId);

      await transactions.updateOne(
        { _id: transaction._id },
        {
          $set: {
            status: "cancelled",
            cancelledAt: now,
            updatedAt: now,
          },
        }
      );
    }
  }

  await downgradeVendor(vendorId);
}

/**
 * checkout.session.expired → the pending transaction never completed
 */
async function handleCheckoutExpired(session) {
  const transactions = getTransactionsCollection();
  const now = new Date();

  const transaction = await transactions.findOne({
    stripeSessionId: session.id,
  });

  if (!transaction || transaction.status === "paid") {
    return;
  }

  await transactions.updateOne(
    { _id: transaction._id },
    { $set: { status: "expired", updatedAt: now } }
  );

  const vendorId = toIdString(
    transaction.vendorId ||
      session.metadata?.vendorId ||
      session.client_reference_id
  );

  if (vendorId) {
    const users = getUsersCollection();
    const vendor = await users.findOne({ id: vendorId });
    // Only clear the plan if this vendor has no other active subscription
    if (vendor && vendor.subscriptionPlan === "premium") {
      const stillPaid = await transactions.findOne({
        vendorId,
        status: "paid",
        _id: { $ne: transaction._id },
      });
      if (!stillPaid) await downgradeVendor(vendorId);
    }
  }
}

const EVENT_HANDLERS = {
  "checkout.session.completed": handleCheckoutCompleted,
  "invoice.payment_succeeded": handleInvoicePaid,
  "invoice.payment_failed": handleInvoiceFailed,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "checkout.session.expired": handleCheckoutExpired,
};

/**
 * POST /api/webhooks/stripe
 * Signature is verified against the RAW request body.
 */
async function stripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({
      success: false,
      message: "Missing Stripe signature",
    });
  }

  if (!WEBHOOK_SECRET || isPlaceholder(WEBHOOK_SECRET)) {
    return res.status(503).json({
      success: false,
      message: "Stripe webhooks are not configured",
    });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Webhook payload must be a raw buffer",
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("❌ Stripe webhook signature verification failed:", error.message);
    return res.status(400).json({
      success: false,
      message: `Webhook signature verification failed: ${error.message}`,
    });
  }

  const handler = EVENT_HANDLERS[event.type];

  if (!handler) {
    // Acknowledge unhandled events so Stripe stops retrying them
    return res.json({ received: true, ignored: event.type });
  }

  try {
    await handler(event.data.object, event);
    return res.json({ received: true });
  } catch (error) {
    console.error(`❌ Stripe webhook ${event.type} failed:`, error);
    // 500 tells Stripe to retry later
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
}

module.exports = {
  stripeWebhook,
  markTransactionPaid,
  resolvePeriodEnd,
};
