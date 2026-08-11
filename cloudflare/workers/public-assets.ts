function responseHeaders(object: R2Object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("accept-ranges", "bytes");
  return headers;
}

type ParsedRange = {
  request: R2Range;
  offset: number;
  length: number;
};

function parseRange(value: string, size: number): ParsedRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;

  if (!match[1]) {
    const suffix = Math.min(Number(match[2]), size);
    return Number.isFinite(suffix) && suffix > 0
      ? { request: { suffix }, offset: size - suffix, length: suffix }
      : null;
  }

  const offset = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(offset) || !Number.isFinite(requestedEnd) || offset < 0 || offset >= size || requestedEnd < offset) {
    return null;
  }

  const length = Math.min(requestedEnd, size - 1) - offset + 1;
  return { request: { offset, length }, offset, length };
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

    if (!(key.startsWith("specialty-images/") || key.startsWith("landing-media/")) || key.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const head = await env.PUBLIC_ASSETS.head(key);
    if (!head) return new Response("Not found", { status: 404 });

    const rangeHeader = request.headers.get("range");
    const range = rangeHeader ? parseRange(rangeHeader, head.size) : null;
    if (rangeHeader && !range) {
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "content-range": `bytes */${head.size}`, "accept-ranges": "bytes" },
      });
    }

    if (request.method === "HEAD") {
      const headers = responseHeaders(head);
      headers.set("content-length", String(head.size));
      return new Response(null, { headers });
    }

    const object = await env.PUBLIC_ASSETS.get(key, range ? { range: range.request } : undefined);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = responseHeaders(object);
    if (range) {
      headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
      headers.set("content-length", String(range.length));
      return new Response(object.body, { status: 206, headers });
    }

    headers.set("content-length", String(head.size));
    return new Response(object.body, { headers });
  },
} satisfies ExportedHandler<Env>;
