/* 验证「填了 Key 还没保存，也能直接测试连接」这条路径。
 * 用法: node scripts/test-draft-credentials.mjs [baseUrl]
 * 全程使用伪造 Key，不会真的调用供应商；结束后清除。
 */
const base = process.argv[2] || "http://127.0.0.1:3000";
const ADMIN = { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123" };

let cookie = "";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
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

function credentialOf(list, id) {
  const item = list?.find((entry) => entry.id === id);
  return {
    configured: item?.configured,
    masked: item?.credentials?.find((f) => f.key === "apiKey")?.masked ?? null,
  };
}

async function main() {
  await req("/api/auth/login", { method: "POST", body: ADMIN });

  const before = credentialOf((await req("/api/admin/providers")).json?.items, "volcengine-ark");
  check("ark starts unconfigured or known", true, `configured=${before.configured}`);

  // 1) 仅带 draft 凭据测试：不应再报「还缺少」
  const draftTest = await req("/api/admin/providers/volcengine-ark/test", {
    method: "POST",
    body: { credentials: { apiKey: "fake-ark-key-for-draft-test-0123456789" } },
  });
  const msg = draftTest.json?.message ?? "";
  check(
    "draft credential is actually used for the test",
    !/缺少/.test(msg),
    msg,
  );
  check("draft test is flagged as unsaved", draftTest.json?.usedDraft === true);
  check(
    "bogus key is rejected by the provider",
    draftTest.json?.ok === false && /401|无效|鉴权/.test(msg),
    msg,
  );

  // 2) 不带 draft 且未保存时，仍应提示缺少
  const noneTest = await req("/api/admin/providers/volcengine-ark/test", { method: "POST", body: {} });
  const savedNow = credentialOf((await req("/api/admin/providers")).json?.items, "volcengine-ark");
  if (!savedNow.configured) {
    check("without draft it reports missing credential", /缺少/.test(noneTest.json?.message ?? ""), noneTest.json?.message);
  } else {
    check("without draft it reports missing credential", true, "skip: 已保存过凭据");
  }

  // 3) 保存 → 变为已配置；再清除
  // 安全护栏：如果该供应商已经存有真实凭据，绝不覆盖（会误删用户的 Key）
  if (before.configured) {
    check("save/clear skipped to protect existing credential", true, "已有凭据，跳过写入型断言");
    const failed = results.filter((item) => !item.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    process.exitCode = failed.length ? 1 : 0;
    return;
  }

  const save = await req("/api/admin/providers/volcengine-ark", {
    method: "PUT",
    body: { credentials: { apiKey: "fake-ark-key-saved-for-test-0123456789" } },
  });
  check(
    "save marks provider configured",
    credentialOf(save.json?.items, "volcengine-ark").configured === true,
    credentialOf(save.json?.items, "volcengine-ark").masked,
  );

  const afterSave = await req("/api/admin/providers/volcengine-ark/test", { method: "POST", body: {} });
  check(
    "saved (bogus) key is tested without draft flag",
    afterSave.json?.usedDraft !== true && /401|无效|鉴权/.test(afterSave.json?.message ?? ""),
    afterSave.json?.message,
  );

  const clear = await req("/api/admin/providers/volcengine-ark", {
    method: "PUT",
    body: { credentials: { apiKey: "" } },
  });
  check(
    "clear removes the credential",
    credentialOf(clear.json?.items, "volcengine-ark").configured === false,
    credentialOf(clear.json?.items, "volcengine-ark").masked ?? "(null)",
  );

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error("crashed:", error);
  process.exitCode = 1;
});