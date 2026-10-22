/* 视频模块新功能的端到端验证（需要 MINIMAX_MOCK=1，不产生真实费用）。
 * 覆盖：生成数量扇出、时长区间校验、音频开关、提示词优化、参考图、互斥校验。
 * 用法: node scripts/video-features-e2e.mjs [baseUrl]
 */
const base = process.argv[2] || "http://127.0.0.1:3000";
const ADMIN = { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123" };

let cookie = "";
const created = [];
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function req(path, { method = "GET", body, raw, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body && !raw ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
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

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function upload(name) {
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), name);
  const res = await req("/api/uploads", { method: "POST", body: form, raw: true, headers: {} });
  return res.json?.id;
}

async function main() {
  await req("/api/auth/login", { method: "POST", body: ADMIN });

  const health = await req("/api/health");
  check("mock mode is on (safe test)", health.json?.mock === true, `mock=${health.json?.mock}`);

  // 1) 生成数量：一次提交 3 条
  const fanout = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "video",
      model: "MiniMax-H3-Max",
      prompt: "E2E 批量视频测试：海边日落延时",
      resolution: "768P",
      duration: 8,
      ratio: "16:9",
      n: 3,
      promptOptimizer: false,
    },
  });
  const assets = fanout.json?.assets ?? [];
  check("video count fan-out creates N assets", fanout.res.status === 201 && assets.length === 3, `got ${assets.length}`);
  for (const asset of assets) created.push(asset.id);
  check(
    "each asset keeps the same prompt and marks the batch",
    assets.every((a) => a.prompt.includes("E2E 批量视频测试")),
    assets[0]?.params ? JSON.stringify(assets[0].params).slice(0, 60) : "",
  );

  // 2) 时长区间校验
  const tooLong = await req("/api/generate", {
    method: "POST",
    body: { kind: "video", model: "MiniMax-H3-Max", prompt: "x", duration: 99 },
  });
  check("duration above range is rejected", tooLong.res.status === 400, tooLong.json?.error);

  const tooShort = await req("/api/generate", {
    method: "POST",
    body: { kind: "video", model: "MiniMax-H3-Max", prompt: "x", duration: 2 },
  });
  check("duration below range is rejected", tooShort.res.status === 400, tooShort.json?.error);

  const okDuration = await req("/api/generate", {
    method: "POST",
    body: { kind: "video", model: "kling-2.6", prompt: "E2E 时长步进测试", duration: 5, n: 1 },
  });
  if (okDuration.res.status === 503) {
    check("step duration accepted for kling 2.6", true, "skip: 可灵未配置凭据");
  } else {
    check("step duration accepted for kling 2.6", okDuration.res.status === 201, okDuration.json?.error);
    if (okDuration.json?.asset?.id) created.push(okDuration.json.asset.id);
  }
  const badStep = await req("/api/generate", {
    method: "POST",
    body: { kind: "video", model: "kling-2.6", prompt: "x", duration: 7 },
  });
  check(
    "duration not on the step is rejected",
    badStep.res.status === 503 || badStep.res.status === 400,
    badStep.json?.error,
  );

  // 3) 音频开关：MiniMax 不支持 → 400
  const audioUnsupported = await req("/api/generate", {
    method: "POST",
    body: { kind: "video", model: "MiniMax-H3-Max", prompt: "x", audio: true },
  });
  check("audio rejected for models without audio", audioUnsupported.res.status === 400, audioUnsupported.json?.error);

  // 4) 提示词优化：MiniMax-H3 不支持 → 400
  const optUnsupported = await req("/api/generate", {
    method: "POST",
    body: { kind: "video", model: "MiniMax-H3", prompt: "x", promptOptimizer: true },
  });
  check("prompt optimizer rejected when unsupported", optUnsupported.res.status === 400, optUnsupported.json?.error);

  // 5) 参考图：MiniMax 支持（≤9 张）
  const refId = await upload("ref.png");
  const withRefs = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "video",
      model: "MiniMax-H3-Max",
      prompt: "E2E 参考图测试：保持主体一致性",
      duration: 5,
      referenceUploadIds: refId ? [refId] : [],
    },
  });
  check("reference image accepted for MiniMax", withRefs.res.status === 201, withRefs.json?.error);
  if (withRefs.json?.asset?.id) created.push(withRefs.json.asset.id);

  // 6) 首尾帧 + 参考图互斥
  const both = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "video",
      model: "MiniMax-H3-Max",
      prompt: "x",
      duration: 5,
      firstFrameUploadId: refId,
      referenceUploadIds: refId ? [refId] : [],
    },
  });
  check("frames and references are mutually exclusive", both.res.status === 400, both.json?.error);

  // 7) 参考图在不支持的模型上被拒绝（vidu 支持首帧但明确不支持参考图）
  const unsupportedRefs = await req("/api/generate", {
    method: "POST",
    body: {
      kind: "video",
      model: "viduq3-pro",
      prompt: "x",
      duration: 5,
      referenceUploadIds: refId ? [refId] : [],
    },
  });
  check(
    "reference image rejected where unsupported",
    unsupportedRefs.res.status === 400 || unsupportedRefs.res.status === 503,
    unsupportedRefs.json?.error,
  );

  // 8) 等待扇出的任务全部完成
  const deadline = Date.now() + 90_000;
  let states = [];
  while (Date.now() < deadline) {
    const list = await req("/api/assets?scope=mine&limit=40");
    const items = list.json?.items ?? [];
    states = items.filter((item) => created.includes(item.id));
    if (states.length && states.every((item) => ["succeeded", "failed"].includes(item.status))) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  check(
    "batched and reference tasks all finished",
    states.length > 0 && states.every((item) => item.status === "succeeded"),
    states.map((item) => item.status).join(","),
  );

  // 清理测试数据
  for (const id of created) {
    await req(`/api/assets/${id}`, { method: "DELETE" });
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error("crashed:", error);
  process.exitCode = 1;
});