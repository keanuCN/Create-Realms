/* Verifies the admin provider-settings feature against a running server.
 * Usage: node scripts/provider-e2e.mjs [baseUrl]
 * Reads the initial MiniMax key from .env only to restore it at the end.
 */
import fs from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:3000";
const ADMIN = { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123" };

let cookie = "";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, json, text };
}

function envKey() {
  try {
    const line = fs
      .readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((item) => item.startsWith("MINIMAX_API_KEY="));
    return line ? line.slice("MINIMAX_API_KEY=".length).trim() : "";
  } catch {
    return "";
  }
}

async function main() {
  const login = await req("/api/auth/login", { method: "POST", body: ADMIN });
  check("admin login", login.res.status === 200);

  const list = await req("/api/admin/providers");
  const minimax = list.json?.items?.find((item) => item.id === "minimax");
  const catalog = list.json?.items?.length ?? 0;
  check("provider list returned", list.res.status === 200 && catalog >= 4, `${catalog} providers`);
  check("minimax key seeded from env/db", Boolean(minimax?.configured), `source=${minimax?.source}`);
  check(
    "key is masked, never raw",
    typeof minimax?.maskedKey === "string" &&
      minimax.maskedKey.includes("•") &&
      !minimax.maskedKey.includes(envKey().slice(10, 30)),
    minimax?.maskedKey,
  );
  check("no raw key field in payload", !/apiKey|api_key/.test(list.text.replace(/apiBase/g, "")));

  const test = await req("/api/admin/providers/minimax/test", { method: "POST" });
  check("connectivity test passes", test.json?.ok === true, test.json?.message);

  // Save a temporary bogus key, then restore the real one.
  const bogus = await req("/api/admin/providers/minimax", {
    method: "PUT",
    body: { apiKey: "sk-cp-temporary-invalid-key-for-e2e" },
  });
  const bogusItem = bogus.json?.items?.find((item) => item.id === "minimax");
  check("saving a new key updates the mask", bogus.res.status === 200 && bogusItem?.maskedKey !== minimax?.maskedKey);

  const bogusTest = await req("/api/admin/providers/minimax/test", { method: "POST" });
  check("bogus key fails the test", bogusTest.json?.ok === false, bogusTest.json?.message);

  const real = envKey();
  if (real) {
    const restore = await req("/api/admin/providers/minimax", {
      method: "PUT",
      body: { apiKey: real },
    });
    const restored = restore.json?.items?.find((item) => item.id === "minimax");
    check("real key restored", restored?.maskedKey === minimax?.maskedKey, restored?.maskedKey);
    const retest = await req("/api/admin/providers/minimax/test", { method: "POST" });
    check("connectivity test passes again", retest.json?.ok === true, retest.json?.message);
  } else {
    check("real key restored", false, ".env 中未找到 MINIMAX_API_KEY");
  }

  check("invalid base url rejected", (await req("/api/admin/providers/minimax", {
    method: "PUT",
    body: { apiBase: "not-a-url" },
  })).res.status === 400);

  const enabled = await req("/api/admin/providers/minimax", {
    method: "PUT",
    body: { apiBase: minimax?.apiBase || "https://api.minimax.cn", enabled: true },
  });
  check("base url + enabled saved", enabled.res.status === 200);

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error("crashed:", error);
  process.exitCode = 1;
});