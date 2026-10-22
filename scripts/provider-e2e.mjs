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

function minimaxKeyOf(list) {
  const item = list?.find((entry) => entry.id === "minimax");
  return item?.credentials?.find((field) => field.key === "apiKey")?.masked ?? null;
}

async function main() {
  const login = await req("/api/auth/login", { method: "POST", body: ADMIN });
  check("admin login", login.res.status === 200);

  const list = await req("/api/admin/providers");
  const items = list.json?.items ?? [];
  check("provider list returned", list.res.status === 200 && items.length >= 8, `${items.length} providers`);

  const expected = ["minimax", "volcengine-ark", "kling", "pixverse", "vidu", "dashscope"];
  check(
    "all requested providers present & ready",
    expected.every((id) => items.find((entry) => entry.id === id)?.status === "ready"),
    expected
      .map((id) => `${id}:${items.find((entry) => entry.id === id)?.status ?? "missing"}`)
      .join(" "),
  );

  const minimax = items.find((entry) => entry.id === "minimax");
  const masked = minimaxKeyOf(items);
  check("minimax key seeded from env/db", Boolean(minimax?.configured), `source=${minimax?.source}`);
  check(
    "key is masked, never raw",
    typeof masked === "string" && masked.includes("•") && !masked.includes(envKey().slice(10, 30)),
    masked,
  );
  check("no raw key field in payload", !list.text.includes(envKey().slice(0, 20)) && !/"apiKey":\s*"/.test(list.text));

  const test = await req("/api/admin/providers/minimax/test", { method: "POST" });
  check("minimax connectivity test passes", test.json?.ok === true, test.json?.message);

  const unconfigured = await req("/api/admin/providers/vidu/test", { method: "POST" });
  check(
    "unconfigured provider reports missing credential",
    unconfigured.json?.ok === false && /缺少/.test(unconfigured.json?.message ?? ""),
    unconfigured.json?.message,
  );

  // Save a temporary bogus key, then restore the real one.
  const bogus = await req("/api/admin/providers/minimax", {
    method: "PUT",
    body: { credentials: { apiKey: "sk-cp-temporary-invalid-key-for-e2e" } },
  });
  check(
    "saving a new credential updates the mask",
    bogus.res.status === 200 && minimaxKeyOf(bogus.json?.items) !== masked,
    minimaxKeyOf(bogus.json?.items),
  );

  const bogusTest = await req("/api/admin/providers/minimax/test", { method: "POST" });
  check("bogus key fails the test", bogusTest.json?.ok === false, bogusTest.json?.message);

  const real = envKey();
  if (real) {
    const restore = await req("/api/admin/providers/minimax", {
      method: "PUT",
      body: { credentials: { apiKey: real } },
    });
    check("real key restored", minimaxKeyOf(restore.json?.items) === masked, minimaxKeyOf(restore.json?.items));
    const retest = await req("/api/admin/providers/minimax/test", { method: "POST" });
    check("connectivity test passes again", retest.json?.ok === true, retest.json?.message);
  } else {
    check("real key restored", false, ".env 中未找到 MINIMAX_API_KEY");
  }

  check(
    "invalid base url rejected",
    (
      await req("/api/admin/providers/minimax", {
        method: "PUT",
        body: { apiBase: "not-a-url" },
      })
    ).res.status === 400,
  );

  check(
    "too-short credential rejected",
    (
      await req("/api/admin/providers/pixverse", {
        method: "PUT",
        body: { credentials: { apiKey: "ab" } },
      })
    ).res.status === 400,
  );

  const enabled = await req("/api/admin/providers/minimax", {
    method: "PUT",
    body: { apiBase: minimax?.apiBase || "https://api.minimax.cn", enabled: true },
  });
  check("base url + enabled saved", enabled.res.status === 200);

  // 成员权限校验：管理员建号 → 成员登录 → 访问管理接口应被拒绝
  const memberName = "e2e_provider_member";
  await req("/api/admin/users", {
    method: "POST",
    body: { username: memberName, displayName: "E2E 成员", password: "e2epass123" },
  });
  const memberLogin = await req("/api/auth/login", {
    method: "POST",
    body: { username: memberName, password: "e2epass123" },
  });
  check("member login", memberLogin.res.status === 200);
  const forbidden = await req("/api/admin/providers");
  check("admin-only endpoint blocked for member", forbidden.res.status === 403, `status=${forbidden.res.status}`);

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error("crashed:", error);
  process.exitCode = 1;
});