export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === "/") {
      return new Response("hello ruby!", {
        headers: { "content-type": "text/plain; charset=UTF-8" },
      })
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=UTF-8" },
    })
  },
}
