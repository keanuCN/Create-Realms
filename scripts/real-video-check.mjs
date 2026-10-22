/* 真实视频生成回归：验证 480P / 5 秒 / 提示词优化关闭 的参数映射。
 * 用法: node scripts/real-video-check.mjs [baseUrl]
 * 会产生一次真实计费（480P 5 秒），用于验证改造后的适配层。
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
      kind: "video",
      model: "MiniMax-H3-Max",
      prompt: "E2E 真实回归：一只猫趴在窗台上打哈欠，午后阳光",
      resolution: "480P",
      duration: 5,
      ratio: "16:9",
      n: 1,
      promptOptimizer: false,
    },
  });
  if (created.res.status !== 201) throw new Error("submit failed: " + created.text);
  const id = created.json.assets?.[0]?.id ?? created.json.asset?.id;
  console.log("submitted", id);

  const deadline = Date.now() + 300_000;
  let asset = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    asset = (await req(`/api/assets/${id}`)).json?.asset;
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
  console.log(
    `succeeded: dur=${asset.durationSeconds}s res=${asset.resolution} ratio=${asset.aspectRatio} ${Math.round(bytes / 1024)}KB`,
  );

  // 清理这条回归测试作品
  await req(`/api/assets/${id}`, { method: "DELETE" });
  console.log("cleaned up test asset");
  process.exitCode = bytes > 10_000 ? 0 : 1;
}

main().catch((error) => {
  console.error("crashed:", error.message);
  process.exitCode = 1;
});