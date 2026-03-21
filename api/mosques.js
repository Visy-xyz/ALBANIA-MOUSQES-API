const mosques = require("../data/mosques.json");

function authenticate(req) {
  const key = req.headers["x-api-key"];
  return key && key === process.env.API_KEY;
}

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

module.exports = (req, res) => {
  // CORS headers (adjust origin for production)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return sendError(res, 405, "Method not allowed");
  if (!authenticate(req)) return sendError(res, 401, "Invalid or missing API key. Pass it as: x-api-key: YOUR_KEY");

  const { id, city, name, limit = "50", page = "1" } = req.query;

  // GET /api/mosques/:id  →  ?id=007
  if (id) {
    const mosque = mosques.find((m) => String(m.id) === id);
    if (!mosque) return sendError(res, 404, `No mosque found with id "${id}"`);
    return res.status(200).json({ success: true, data: mosque });
  }

  let results = [...mosques];

  // Filter by city (case-insensitive partial match)
  if (city) {
    results = results.filter((m) =>
      m.city.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Filter by name (case-insensitive partial match)
  if (name) {
    results = results.filter((m) =>
      m.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const total = results.length;
  const totalPages = Math.ceil(total / limitNum);
  const start = (pageNum - 1) * limitNum;
  const paginated = results.slice(start, start + limitNum);

  res.status(200).json({
    success: true,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    },
    data: paginated,
  });
};