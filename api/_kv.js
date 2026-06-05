// Tiny Upstash Redis (REST) helper shared by the practice-call endpoints.
// Works with the env vars injected by the Vercel Marketplace "Upstash Redis"
// integration (KV_REST_API_URL / KV_REST_API_TOKEN) or the native Upstash
// names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
//
// If no DB is configured, isConfigured() returns false and callers fall back
// gracefully (the app keeps working off each browser's localStorage).

const URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export function isConfigured() {
  return !!(URL && TOKEN);
}

// Run one Redis command via the Upstash REST API, e.g. cmd(["LPUSH","key","val"]).
export async function cmd(command) {
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (!r.ok || (data && data.error)) {
    throw new Error((data && data.error) || `KV error ${r.status}`);
  }
  return data.result;
}

export const PRACTICE_KEY = "saraf_practice_calls_v1";
