import "./polyfills"
import { handleRequest } from "./ruby-runtime"
import type { Env } from "./types.d.ts"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const message = await handleRequest(env, request)
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
