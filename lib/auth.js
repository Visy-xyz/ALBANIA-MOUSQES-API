const { getDB } = require("./firebase");
const { FieldValue } = require("firebase-admin/firestore");

async function validateRequest(req) {
  const key = req.headers["x-api-key"];

  if (!key) {
    return {
      valid: false,
      status: 401,
      error: "Missing API key. Add header: x-api-key: YOUR_KEY",
    };
  }

  const db = getDB();

  // 1. Check key exists and is active
  const keyDoc = await db.collection("api_keys").doc(key).get();

  if (!keyDoc.exists || !keyDoc.data().is_active) {
    return {
      valid: false,
      status: 401,
      error: "Invalid or inactive API key",
    };
  }

  const keyData = keyDoc.data();

  // 2. Rate limit — count requests in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentLogs = await db
    .collection("request_logs")
    .where("api_key", "==", key)
    .where("created_at", ">=", oneHourAgo)
    .count()
    .get();

  const count = recentLogs.data().count;

  if (count >= keyData.rate_limit_per_hour) {
    return {
      valid: false,
      status: 429,
      error: `Rate limit exceeded. Max ${keyData.rate_limit_per_hour} requests/hour. Try again later.`,
    };
  }

  // 3. Log request (fire and forget)
  const url = new URL(req.url, "http://localhost");
  db.collection("request_logs")
    .add({
      api_key: key,
      endpoint: url.pathname,
      query_params: url.search || null,
      created_at: new Date(),
    })
    .catch(() => {});

  // 4. Update last_used_at (fire and forget)
  db.collection("api_keys")
    .doc(key)
    .update({ last_used_at: FieldValue.serverTimestamp() })
    .catch(() => {});

  return { valid: true, keyData };
}

module.exports = { validateRequest };