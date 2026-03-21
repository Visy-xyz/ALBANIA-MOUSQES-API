const { getDB } = require("../lib/firebase");
const { generateKey } = require("../lib/keygen");
const { FieldValue } = require("firebase-admin/firestore");

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

function isAdminAuthorized(req) {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "x-admin-password, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!isAdminAuthorized(req)) return sendError(res, 401, "Invalid admin password");

  const { action, id } = req.query;

  // ── ping ── just checks password, no Firebase needed
  if (action === "ping") {
    return res.status(200).json({ success: true, message: "Authorized" });
  }

  const db = getDB();

  // ── GET keys ── List all API keys
  if (req.method === "GET" && action === "keys") {
    const snap = await db
      .collection("api_keys")
      .orderBy("created_at", "desc")
      .get();

    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.().toISOString(),
      last_used_at: doc.data().last_used_at?.toDate?.().toISOString() || null,
    }));

    return res.status(200).json({ success: true, data });
  }

  // ── GET stats ── Usage overview
  if (req.method === "GET" && action === "stats") {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const [keysSnap, daySnap, hourSnap] = await Promise.all([
      db.collection("api_keys").count().get(),
      db.collection("request_logs").where("created_at", ">=", oneDayAgo).get(),
      db.collection("request_logs").where("created_at", ">=", oneHourAgo).count().get(),
    ]);

    const keyUsage = {};
    daySnap.docs.forEach((doc) => {
      const k = doc.data().api_key;
      keyUsage[k] = (keyUsage[k] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        total_keys: keysSnap.data().count,
        requests_last_24h: daySnap.size,
        requests_last_hour: hourSnap.data().count,
        usage_per_key_24h: keyUsage,
      },
    });
  }

  // ── POST create ── Create a new key
  if (req.method === "POST" && action === "create") {
    const { owner, description, rate_limit_per_hour = 500 } = req.body || {};
    if (!owner) return sendError(res, 400, "owner is required");

    const newKey = generateKey();

    const keyData = {
      owner,
      description: description || null,
      is_active: true,
      rate_limit_per_hour: parseInt(rate_limit_per_hour, 10),
      created_at: FieldValue.serverTimestamp(),
      last_used_at: null,
    };

    await db.collection("api_keys").doc(newKey).set(keyData);

    return res.status(201).json({
      success: true,
      message: "Key created. Save it now — it won't be shown again in full.",
      data: { id: newKey, key: newKey, ...keyData, created_at: new Date().toISOString() },
    });
  }

  // ── PATCH toggle ── Activate or deactivate a key
  if (req.method === "PATCH" && action === "toggle") {
    if (!id) return sendError(res, 400, "id is required");

    const docRef = db.collection("api_keys").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return sendError(res, 404, "Key not found");

    const newStatus = !snap.data().is_active;
    await docRef.update({ is_active: newStatus });

    return res.status(200).json({ success: true, data: { id, is_active: newStatus } });
  }

  // ── DELETE ── Permanently delete a key
  if (req.method === "DELETE" && action === "delete") {
    if (!id) return sendError(res, 400, "id is required");

    await db.collection("api_keys").doc(id).delete();
    return res.status(200).json({ success: true, message: "Key deleted" });
  }

  return sendError(res, 400, "Unknown action. Use: keys, stats, create, toggle, delete");
};