import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let serverModule: any;

function getServerModule() {
  if (!serverModule) {
    serverModule = require("../dist/index.cjs");
  }

  return serverModule;
}

export default async function handler(req: any, res: any) {
  try {
    const server = getServerModule();
    await server.ready;
    return server.default(req, res);
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
