const fs = require("fs");
const path = require("path");
const { validateRequest } = require("../lib/auth");

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

function loadMosques() {
  const countrySources = [
    { code: "albania", name: "Albania" },
    { code: "kosovo", name: "Kosovo" },
    { code: "macedonia", name: "North Macedonia" },
    { code: "maliizi", name: "Montenegro" },
  ];

  let all = [];

  countrySources.forEach(({ code, name }) => {
    const filePath = path.join(__dirname, "..", "data", `${code}.json`);
    if (!fs.existsSync(filePath)) return;

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(data)) return;

    all = all.concat(
      data.map((item) => ({
        ...item,
        country: name,
        sourceId: String(item.id),
        uid: `${code}-${String(item.id)}`,
      }))
    );
  });

  return all;
}

const mosques = loadMosques();

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return sendError(res, 405, "Method not allowed");

  const auth = await validateRequest(req);
  if (!auth.valid) return sendError(res, auth.status, auth.error);

  const {
    id,
    city,
    name,
    country,
    limit = "50",
    page = "1",
  } = req.query;

  // Get single by ID or UID
  if (id) {
    const rawId = String(id).trim();
    const normalizedUid = rawId.replace(/:/g, "-").toLowerCase();

    let mosque = mosques.find(
      (m) => String(m.uid).toLowerCase() === normalizedUid
    );

    if (!mosque) {
      mosque = mosques.find((m) => {
        const sameId = String(m.id) === rawId;
        const countryMatch =
          !country || m.country.toLowerCase() === String(country).toLowerCase();
        return sameId && countryMatch;
      });
    }

    if (!mosque) return sendError(res, 404, `No mosque found with id "${id}"`);

    return res.status(200).json({ success: true, data: mosque });
  }

  let results = [...mosques];

  if (country) {
    results = results.filter(
      (m) => m.country.toLowerCase() === String(country).toLowerCase()
    );
  }

  if (city) {
    results = results.filter((m) =>
      String(m.city).toLowerCase().includes(String(city).toLowerCase())
    );
  }

  if (name) {
    results = results.filter((m) =>
      String(m.name).toLowerCase().includes(String(name).toLowerCase())
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