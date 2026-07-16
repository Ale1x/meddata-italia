interface Env {
  PRIVATE_API: Fetcher
  API_RATE_LIMITER: RateLimit
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url)

    if (incoming.pathname === "/metrics") {
      return new Response("Not found", { status: 404 })
    }

    const rateLimited = incoming.pathname === "/api/v1" || incoming.pathname.startsWith("/api/v1/")
    if (rateLimited && request.method !== "OPTIONS") {
      const clientIP = request.headers.get("CF-Connecting-IP") ?? "unknown"
      const { success } = await env.API_RATE_LIMITER.limit({ key: clientIP })
      if (!success) {
        const rateLimitHeaders = new Headers({
          "Cache-Control": "no-store",
          "Retry-After": "10",
          "RateLimit-Policy": "200;w=10",
        })
        if (request.headers.get("Origin") === "https://health.passarelli.dev") {
          rateLimitHeaders.set("Access-Control-Allow-Origin", "https://health.passarelli.dev")
          rateLimitHeaders.set("Access-Control-Expose-Headers", "Retry-After, RateLimit-Policy")
          rateLimitHeaders.set("Vary", "Origin")
        }
        return Response.json(
          {
            error: {
              code: "rate_limit_exceeded",
              detail: "Too many requests. The public limit is 200 requests per 10 seconds per client.",
              status: 429,
            },
          },
          {
            status: 429,
            headers: rateLimitHeaders,
          },
        )
      }
    }

    const target = new URL(
      `http://public-api.medicine-platform.svc.cluster.local:8080${incoming.pathname}${incoming.search}`,
    )

    const headers = new Headers(request.headers)
    headers.set("X-Forwarded-Host", incoming.host)
    headers.set("X-Forwarded-Proto", "https")

    const response = await env.PRIVATE_API.fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }),
    )

    if (!rateLimited) return response

    const responseHeaders = new Headers(response.headers)
    responseHeaders.set("RateLimit-Policy", "200;w=10")
    const exposedHeaders = responseHeaders.get("Access-Control-Expose-Headers")
    if (exposedHeaders && !exposedHeaders.includes("RateLimit-Policy")) {
      responseHeaders.set("Access-Control-Expose-Headers", `${exposedHeaders}, RateLimit-Policy`)
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  },
} satisfies ExportedHandler<Env>
