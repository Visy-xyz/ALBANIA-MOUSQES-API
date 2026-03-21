const crypto = require("crypto");

function generateKey() {
  return "xhamia_live_" + crypto.randomBytes(20).toString("hex");
}

module.exports = { generateKey };