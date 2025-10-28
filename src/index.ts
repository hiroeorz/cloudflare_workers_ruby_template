import "./polyfills"
import { handleRequest } from "./ruby-runtime"
import type { Env } from "./types.d.ts"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const { body, status, headers } = await handleRequest(env, request)
      return new Response(body, {
        status,
        headers,
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
