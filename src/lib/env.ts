import path from "node:path";

// Next.js loads .env automatically; worker / migrate scripts need a hand.
try {
  process.loadEnvFile?.(".env");
} catch {
  // no .env file — rely on real environment variables
}

function bool(value: string | undefined, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  appName: process.env.APP_NAME || "AIGC 工坊",
  databaseUrl:
    process.env.DATABASE_URL || "postgres://aigc:aigc@127.0.0.1:5432/aigc",
  mediaDir: path.resolve(process.env.MEDIA_DIR || "./data/media"),
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY || "",
    apiBase: (process.env.MINIMAX_API_BASE || "https://api.minimax.cn").replace(
      /\/+$/,
      "",
    ),
    mock: bool(process.env.MINIMAX_MOCK),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
    pollMs: Number(process.env.WORKER_POLL_MS || 2500),
  },
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "",
  },
  allowSignup: bool(process.env.ALLOW_SIGNUP, false),
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  // Used to encrypt provider API keys stored in the database.
  appSecret: process.env.APP_SECRET || "aigc-studio-default-app-secret",
};

export function hasApiKey() {
  return Boolean(env.minimax.apiKey);
}
