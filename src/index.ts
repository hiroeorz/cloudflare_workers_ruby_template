import "./polyfills"
import { runRubyKVTest, runRubyD1Test } from "./ruby-runtime"
import type { Env } from "./types.d.ts"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    let message: string

    try {
      switch (pathname) {
        case "/":
          message = "Hello World"
          break
        case "/kv":
          message = await runRubyKVTest(env)
          break
        case "/d1":
          message = await runRubyD1Test(env)
          break
        default:
          return new Response("ページが見つかりません", {
            status: 404,
            headers: { "content-type": "text/plain; charset=UTF-8" },
          })
      }

      return new Response(message, {
        headers: { "content-type": "text/plain; charset=UTF-8" },
      })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "予期しないエラーが発生しました"
      return new Response(`Ruby実行エラー: ${reason}`, {
        status: 500,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      })
    }
  },
}
