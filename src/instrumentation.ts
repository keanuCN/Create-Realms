export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { initSchema } = await import("./lib/migrate");
    await initSchema();
  } catch (error) {
    console.error("[instrumentation] database init failed", error);
  }
}
