/* End-to-end smoke test against a running server (dev or prod).
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 * Logs in as admin, uploads a reference image, submits image-to-video,
 * submits text-to-image (n=2), waits for completion, checks media,
 * creates a share link and verifies unauthenticated access, then
 * creates/edits/deletes a prompt template.
 */
const base = process.argv[2] || "http://127.0.0.1:3000";
const ADMIN = { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123" };

let cookie = "";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function req(path, { method = "GET", body, headers = {}, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body && !raw ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
    redirect: "manual",
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

function pngBytes() {
  // 1x1 red pixel PNG
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function main() {
  // 1. login
  const login = await req("/api/auth/login", { method: "POST", body: ADMIN });
  check("login", login.res.status === 200 && login.json?.user?.username === "admin");

  // 2. upload reference image
  const form = new FormData();
  form.append("file", new Blob([pngBytes()], { type: "image/png" }), "ref.png");
  const up = await req("/api/uploads", { method: "POST", body: form, raw: true, headers: {} });
  check("upload reference image", up.res.status === 201 && !!up.json?.id, up.text.slice(0, 120));
  const uploadId = up.json?.id;

  // 3. image-to-video (first frame)
  const i2v = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "video",
      model: "MiniMax-H3-Max",
      prompt: "E2E 图生视频测试：镜头缓慢推近",
      resolution: "768P",
      duration: 5,
      firstFrameUploadId: uploadId,
    },
  });
  check("submit image-to-video", i2v.res.status === 201 && !!i2v.json?.asset?.id);
  const i2vId = i2v.json?.asset?.id;

  // 4. text-to-image with n=2
  const t2i = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "image",
      model: "image-01",
      prompt: "E2E 文生图测试：极简咖啡杯",
      ratio: "16:9",
      n: 2,
    },
  });
  check("submit text-to-image n=2", t2i.res.status === 201);
  const t2iId = t2i.json?.asset?.id;

  // 5. poll until done
  const deadline = Date.now() + 90_000;
  let assets = [];
  while (Date.now() < deadline) {
    const list = await req("/api/assets?scope=mine&limit=20");
    assets = list.json?.items ?? [];
    const mine = assets.filter((a) => a.id === i2vId || a.id === t2iId || a.id?.startsWith(t2iId));
    const done = assets.find((a) => a.id === i2vId)?.status;
    const extra = assets.filter((a) => a.prompt?.startsWith("E2E 文生图"));
    if (
      (done === "succeeded" || done === "failed") &&
      extra.length >= 2 &&
      extra.every((a) => a.status === "succeeded" || a.status === "failed")
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  const i2vAsset = assets.find((a) => a.id === i2vId);
  check("i2v job finished", i2vAsset?.status === "succeeded", `status=${i2vAsset?.status} err=${i2vAsset?.errorMessage ?? ""}`);
  const images = assets.filter((a) => a.prompt?.startsWith("E2E 文生图"));
  check("t2i produced 2 assets", images.length === 2 && images.every((a) => a.status === "succeeded"), `got ${images.length}`);

  // 6. media fetch + range request
  if (i2vAsset?.mediaUrl) {
    const media = await req(i2vAsset.mediaUrl, { headers: { range: "bytes=0-1023" } });
    check("media range request", media.res.status === 206, `status=${media.res.status}`);
  } else {
    check("media range request", false, "no mediaUrl");
  }

  // 7. share + unauthenticated access
  const share = await req(`/api/assets/${i2vId}/share`, { method: "POST" });
  check("create share", share.res.status === 200 && !!share.json?.token);
  const token = share.json?.token;
  if (token) {
    const savedCookie = cookie;
    cookie = "";
    const page = await fetch(`${base}/s/${token}`);
    check("share page public", page.status === 200, `status=${page.status}`);
    const mediaPublic = await fetch(`${base}${i2vAsset.mediaUrl}?share=${token}`);
    check("share media public", mediaPublic.status === 200, `status=${mediaPublic.status}`);
    const mediaDenied = await fetch(`${base}${i2vAsset.mediaUrl}`);
    check("media denied without login", mediaDenied.status === 401, `status=${mediaDenied.status}`);
    cookie = savedCookie;
  }

  // 8. favorite + title patch
  const patch = await req(`/api/assets/${i2vId}`, {
    method: "PATCH",
    body: { isFavorite: true, title: "E2E 测试作品" },
  });
  check("patch asset favorite+title", patch.res.status === 200 && patch.json?.asset?.isFavorite === true);

  // 9. prompts CRUD
  const pCreate = await req("/api/prompts", {
    method: "POST",
    body: { title: "E2E 模板", content: "测试内容：电影感灯塔", tags: ["e2e"], kind: "video", isShared: true },
  });
  check("create prompt", pCreate.res.status === 201 && !!pCreate.json?.item?.id);
  const pid = pCreate.json?.item?.id;
  const pList = await req("/api/prompts?scope=shared");
  check("list shared prompts", pList.res.status === 200 && pList.json?.items?.some((p) => p.id === pid));
  const pUse = await req(`/api/prompts/${pid}/use`, { method: "POST" });
  check("use prompt", pUse.res.status === 200);
  const pDel = await req(`/api/prompts/${pid}`, { method: "DELETE" });
  check("delete prompt", pDel.res.status === 200);

  // 10. admin user create + login as them
  const uname = "e2e_" + Date.now().toString(36);
  const uCreate = await req("/api/admin/users", {
    method: "POST",
    body: { username: uname, displayName: "E2E 同事", password: "e2epass123", role: "member" },
  });
  check("admin create user", uCreate.res.status === 201);
  const savedCookie = cookie;
  cookie = "";
  const uLogin = await req("/api/auth/login", { method: "POST", body: { username: uname, password: "e2epass123" } });
  check("new user login", uLogin.res.status === 200);
  const forbidden = await req("/api/admin/users");
  check("member blocked from admin API", forbidden.res.status === 403, `status=${forbidden.res.status}`);
  cookie = savedCookie;

  // 11. health
  const health = await req("/api/health");
  check("health: db + worker", health.json?.db === true && health.json?.worker?.alive === true, JSON.stringify(health.json?.worker));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error("E2E crashed:", error);
  process.exitCode = 1;
});
