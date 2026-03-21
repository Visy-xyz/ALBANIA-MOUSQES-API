const mosques = require("../data/mosques.json");
const { validateRequest } = require("../lib/auth");

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return sendError(res, 405, "Method not allowed");

  const auth = await validateRequest(req);
  if (!auth.valid) return sendError(res, auth.status, auth.error);

  const { id, city, name, limit = "50", page = "1" } = req.query;

  // Get single by ID
  if (id) {
    const mosque = mosques.find((m) => String(m.id) === id);
    if (!mosque) return sendError(res, 404, `No mosque found with id "${id}"`);
    return res.status(200).json({ success: true, data: mosque });
  }

  let results = [...mosques];

  if (city) {
    results = results.filter((m) =>
      m.city.toLowerCase().includes(city.toLowerCase())
    );
  }

  if (name) {
    results = results.filter((m) =>
      m.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const total = results.length;
  const totalPages = Math.ceil(total / limitNum);
  const start = (pageNum - 1) * limitNum;
  const paginated = results.slice(start, start + limitNum);

  res.status(200).json({
    success: true,
    meta: { total, page: pageNum, limit: limitNum, totalPages },
    data: paginated,
  });
};