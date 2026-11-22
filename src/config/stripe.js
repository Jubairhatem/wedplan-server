const Stripe = require("stripe");
const env = require("./env");

const isPlaceholder = (value) =>
  !value || /placeholder|your_|_here$/i.test(String(value).trim());

const isStripeConfigured =
  !isPlaceholder(env.STRIPE_SECRET_KEY) && !isPlaceholder(env.STRIPE_PREMIUM_PRICE_ID);

if (!isStripeConfigured) {
  console.warn(
    "⚠️  Stripe credentials are placeholders — premium checkout is disabled until real keys are set."
  );
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  appInfo: {
    name: "WedPlan",
    version: "1.0.0",
  },
});

module.exports = {
  stripe,
  isStripeConfigured,
  isPlaceholder,
  PREMIUM_PRICE_ID: env.STRIPE_PREMIUM_PRICE_ID,
  WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
};
