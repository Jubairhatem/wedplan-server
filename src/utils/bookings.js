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

module.exports = {
  toIdString,
  startOfTodayUTC,
};
