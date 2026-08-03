/* worker.js — the ONLY server-side piece of Epiwen.
 *
 * It exists for one reason: GitHub's OAuth token exchange requires the app's
 * client SECRET, which can never be shipped in a static page. (The secret-free
 * device flow is not an option either — github.com/login/* sends no CORS
 * headers, so a browser cannot call it. Verified.)
 *
 * So this endpoint does exactly one thing: swap the short-lived ?code= that
 * GitHub hands back for an access token. It stores nothing, logs nothing, and
 * never sees the user's data.
 *
 *   POST { code: "..." }  ->  { access_token: "gho_..." }
 *
 * Deploy: see README.md in this folder.
 *
 * Cloudflare Workers is the reference target; the handler is plain fetch, so
 * Netlify/Vercel need only their own wrapper (see README).
 */

// Only these origins may call the exchange. Without this, anyone could point
// their own site at your worker and mint tokens under your OAuth App's name.
const ALLOWED_ORIGINS = [
  "https://epiwen.github.io",
  "http://localhost:3456",          // local preview
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(origin)),
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, origin);
    }
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "origin not allowed" }, 403, origin);
    }
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return json({ error: "worker is missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET" }, 500, origin);
    }

    let code = "";
    try {
      code = ((await request.json()) || {}).code || "";
    } catch (e) { /* fall through to the empty check */ }
    if (!code) return json({ error: "missing code" }, 400, origin);

    const gh = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const data = await gh.json().catch(function () { return {}; });

    // GitHub answers 200 with an `error` field on a bad/expired/reused code.
    if (!data.access_token) {
      return json({ error: data.error_description || data.error || "exchange failed" }, 400, origin);
    }
    // Pass back ONLY the token — never the raw payload, never a log line.
    return json({ access_token: data.access_token, scope: data.scope || "" }, 200, origin);
  },
};
