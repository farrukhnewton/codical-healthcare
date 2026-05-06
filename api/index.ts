export default async function handler(req: any, res: any) {
  try {
    const { default: app, ready } = await import("../server/index");
    await ready;
    return app(req, res);
  } catch (error: any) {
    console.error("API startup failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        code: "API_STARTUP_FAILED",
        message: error?.message || "API startup failed",
      });
    }
    throw error;
  }
}
