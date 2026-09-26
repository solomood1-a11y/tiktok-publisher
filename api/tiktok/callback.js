const REDIRECT_URI = "https://solomood-publisher.vercel.app/api/tiktok/callback";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";").map((part) => part.trim());
  const entry = cookies.find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    res.status(400).send(`<h1>TikTok authorization failed</h1><p>${escapeHtml(errorDescription || error)}</p>`);
    return;
  }

  if (!code || !state || state !== getCookie(req, "tiktok_oauth_state")) {
    res.status(400).send("<h1>Invalid OAuth response</h1><p>The state check failed. Please try again.</p>");
    return;
  }

  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    res.status(500).send("<h1>Configuration error</h1><p>TikTok OAuth environment variables are missing.</p>");
    return;
  }

  try {
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code: String(code),
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || token.error) {
      throw new Error(token.error_description || token.error || "Token exchange failed");
    }

    const profileResponse = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    const profile = await profileResponse.json();
    if (!profileResponse.ok || profile.error?.code !== "ok") {
      throw new Error(profile.error?.message || "Profile request failed");
    }

    const user = profile.data?.user || {};
    res.setHeader(
      "Set-Cookie",
      "tiktok_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    );
    res.status(200).send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تم الربط</title><body><h1>تم ربط حساب TikTok</h1><p>الحساب: ${escapeHtml(user.display_name || "غير متاح")}</p><p>تم التحقق من تدفق Login Kit بنجاح.</p><a href="/">العودة للموقع</a></body></html>`);
  } catch (err) {
    res.status(502).send(`<h1>تعذر إكمال الربط</h1><p>${escapeHtml(err.message)}</p>`);
  }
};
