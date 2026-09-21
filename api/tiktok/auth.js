const crypto = require("crypto");

const REDIRECT_URI = "https://tiktok-publisher-puce.vercel.app/api/tiktok/callback";

module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    res.status(500).send("TIKTOK_CLIENT_KEY is not configured");
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  res.setHeader(
    "Set-Cookie",
    `tiktok_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: "user.info.basic",
    redirect_uri: REDIRECT_URI,
    state,
  });

  res.writeHead(302, {
    Location: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
  });
  res.end();
};
