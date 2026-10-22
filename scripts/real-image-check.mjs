/* One real image generation through the DB-stored provider key.
 * Usage: node scripts/real-image-check.mjs [baseUrl]
 * Costs one image-01 call — used to prove the runtime key path works.
 */
const base = process.argv[2] || "http://127.0.0.1:3000";
let cookie = "";

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

async function main() {
  const login = await req("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123" },
  });
  if (login.res.status !== 200) throw new Error("login failed");

  const created = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "image",
      model: "image-01",
      prompt: "一只戴围巾的橘猫坐在窗台上，午后阳光，浅景深，摄影质感",
      ratio: "1:1",
      n: 1,
    },
  });
  if (created.res.status !== 201) throw new Error("submit failed: " + created.text);
  const id = created.json.asset.id;
  console.log("submitted", id);

  const deadline = Date.now() + 180_000;
  let asset = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const one = await req(`/api/assets/${id}`);
    asset = one.json?.asset;
    console.log("  status:", asset?.status);
    if (asset && ["succeeded", "failed"].includes(asset.status)) break;
  }

  if (asset?.status !== "succeeded") {
    console.log("FAILED:", asset?.errorMessage || asset?.status);
    process.exitCode = 1;
    return;
  }
  const media = await fetch(base + asset.mediaUrl, { headers: { cookie } });
  const bytes = (await media.arrayBuffer()).byteLength;
  console.log("succeeded:", asset.mediaUrl, media.headers.get("content-type"), bytes, "bytes");
  process.exitCode = bytes > 1000 ? 0 : 1;
}

main().catch((error) => {
  console.error("crashed:", error.message);
  process.exitCode = 1;
});