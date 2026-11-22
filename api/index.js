// Vercel serverless entry point for the WedPlan Express API.
// The Express app is exported directly; Vercel handles the request/response
// cycle. MongoDB connects on first invocation and reuses the client across
// warm invocations via module-level state in src/config/db.
const app = require("../src/app");

module.exports = app;
