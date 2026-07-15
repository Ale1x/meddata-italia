interface Env {
  PRIVATE_API: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url)
    const target = new URL(
      `http://public-api.medicine-platform.svc.cluster.local:8080${incoming.pathname}${incoming.search}`,
    )

    const headers = new Headers(request.headers)
    headers.set("X-Forwarded-Host", incoming.host)
    headers.set("X-Forwarded-Proto", "https")

    return env.PRIVATE_API.fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }),
    )
  },
} satisfies ExportedHandler<Env>
