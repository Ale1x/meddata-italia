interface Env {
  FRONTEND: R2Bucket
}

const contentTypes: Record<string, string> = {
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {status: 405})
    }

    const url = new URL(request.url)
    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
    if (!key) key = "index.html"

    let object = await env.FRONTEND.get(key)
    if (!object && !key.includes(".")) {
      key = "index.html"
      object = await env.FRONTEND.get(key)
    }
    if (!object) return new Response("Not found", {status: 404})

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    const extension = key.split(".").pop()?.toLowerCase() ?? ""
    if (!headers.has("Content-Type") && contentTypes[extension]) {
      headers.set("Content-Type", contentTypes[extension])
    }
    headers.set("ETag", object.httpEtag)
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    headers.set("Content-Security-Policy", "default-src 'self'; connect-src 'self' https://api.health.passarelli.dev; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'")
    headers.set("Cache-Control", key === "index.html" ? "no-cache" : "public, max-age=31536000, immutable")

    return new Response(request.method === "HEAD" ? null : object.body, {headers})
  },
}
