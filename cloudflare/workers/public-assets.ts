function responseHeaders(object: R2Object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  return headers;
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const pathname = new URL(request.url).pathname;
    let key: string;
    try {
      key = decodeURIComponent(pathname).replace(/^\/+/, "");
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    if (!key.startsWith("specialty-images/") || key.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const object = await env.PUBLIC_ASSETS.get(key);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = responseHeaders(object);
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  },
} satisfies ExportedHandler<Env>;
