import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"
import hostBridgeScript from "../app/hibana/host_bridge.rb"
import contextScript from "../app/hibana/context.rb"
import kvClientScript from "../app/hibana/kv_client.rb"
import hibanaHelperScript from "../app/helpers/application_helper.rb"
import d1ClientScript from "../app/hibana/d1_client.rb"
import r2ClientScript from "../app/hibana/r2_client.rb"
import routingScript from "../app/hibana/routing.rb"
import appScript from "../app/app.rb"

type HostGlobals = typeof globalThis & {
  tsCallBinding?: (
    binding: string,
    method: string,
    args: unknown[],
  ) => Promise<unknown>
  tsRunD1Query?: (
    binding: string,
    sql: string,
    bindings: unknown[],
    action: "first" | "all" | "run",
  ) => Promise<string>
}

interface WorkerResponsePayload {
  body: string
  status: number
  headers: Record<string, string>
}

type D1PreparedStatement = {
  bind: (...args: unknown[]) => D1PreparedStatement
  first: () => Promise<unknown>
  all: () => Promise<{ results: unknown } | unknown>
  run: () => Promise<unknown>
}

let rubyVmPromise: Promise<RubyVM> | null = null

async function setupRubyVM(env: Env): Promise<RubyVM> {
  if (!rubyVmPromise) {
    rubyVmPromise = (async () => {
      const moduleCandidate = rubyWasmAsset as unknown
      const module =
        moduleCandidate instanceof WebAssembly.Module
          ? moduleCandidate
          : await WebAssembly.compile(moduleCandidate as ArrayBuffer)

      const { vm } = await DefaultRubyVM(module, {
        consolePrint: true,
        env: {
          RUBYOPT: "--disable-did_you_mean",
        },
      })

      // 順序が重要
      await vm.evalAsync(hostBridgeScript) // 1. ブリッジ
      registerHostFunctions(vm, env) // 2. ブリッジに関数を登録
      await vm.evalAsync(contextScript) // 3. コンテキスト
      await vm.evalAsync(kvClientScript) // 4. KVクライアント
      await vm.evalAsync(hibanaHelperScript) // 5. ヘルパー
      await vm.evalAsync(d1ClientScript) // 6. D1クライアント
      await vm.evalAsync(r2ClientScript) // 7. R2クライアント
      await vm.evalAsync(routingScript) // 8. ルーティングDSL
      await vm.evalAsync(appScript) // 9. ルート定義

      return vm
    })()
  }
  return rubyVmPromise
}

export async function handleRequest(
  env: Env,
  request: Request,
): Promise<WorkerResponsePayload> {
  const vm = await setupRubyVM(env)
  const url = new URL(request.url)
  const pathname = url.pathname

  const context = vm.eval("RequestContext.new")
  const queryJson = JSON.stringify(buildQueryObject(url.searchParams))
  const queryArg = vm.eval(toRubyStringLiteral(queryJson))
  context.call("set_query_from_json", queryArg)
  const dispatcher = vm.eval("method(:dispatch)")
  const methodArg = vm.eval(toRubyStringLiteral(request.method))
  const pathArg = vm.eval(toRubyStringLiteral(pathname))
  const result = await dispatcher.callAsync("call", methodArg, pathArg, context)
  const serialized = result.toString()

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error"
    throw new Error(
      `Failed to parse Ruby response payload: ${reason}\nPayload: ${serialized}`,
    )
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("body" in parsed) ||
    !("status" in parsed) ||
    !("headers" in parsed)
  ) {
    throw new Error("Ruby response payload is malformed")
  }

  const payload = parsed as {
    body: unknown
    status: unknown
    headers: Record<string, unknown>
  }

  const headers: Record<string, string> = {}
  if (payload.headers && typeof payload.headers === "object") {
    for (const [key, value] of Object.entries(payload.headers)) {
      if (value === undefined || value === null) {
        continue
      }
      headers[key] = typeof value === "string" ? value : String(value)
    }
  }

  const body =
    typeof payload.body === "string" ? payload.body : String(payload.body ?? "")
  const status =
    typeof payload.status === "number"
      ? payload.status
      : Number(payload.status ?? 200)

  return { body, status, headers }
}

function registerHostFunctions(vm: RubyVM, env: Env): void {
  const host = globalThis as HostGlobals

  if (typeof host.tsCallBinding !== "function") {
    host.tsCallBinding = async (
      binding: string,
      method: string,
      args: unknown[],
    ): Promise<unknown> => {
      const target = (env as Record<string, unknown>)[binding]
      if (!target || typeof target !== "object") {
        throw new Error(`Binding '${binding}' is not available`)
      }
      const targetMethod = (target as Record<string, unknown>)[method]
      if (typeof targetMethod !== "function") {
        throw new Error(`Method '${method}' is not available on '${binding}'`)
      }
      const result = await Reflect.apply(
        targetMethod as (...methodArgs: unknown[]) => unknown,
        target,
        args,
      )
      if (result === undefined) {
        return null
      }
      return result
    }
  }

  // D1クエリを実行する汎用的な非同期関数
  if (typeof host.tsRunD1Query !== "function") {
    host.tsRunD1Query = async (
      binding: string,
      sql: string,
      bindings: unknown[],
      action: "first" | "all" | "run",
    ): Promise<string> => {
      try {
        const db = (env as Record<string, unknown>)[binding]
        if (!db || typeof db !== "object") {
          throw new Error(`Binding '${binding}' is not available`)
        }
        const prepare = (db as Record<string, unknown>).prepare
        if (typeof prepare !== "function") {
          throw new Error(`Binding '${binding}' does not support prepare`)
        }
        const stmt = Reflect.apply(prepare, db, [sql]) as D1PreparedStatement
        const bindingsArray = Array.isArray(bindings) ? bindings : [bindings]
        const bindMethod = stmt.bind
        if (typeof bindMethod !== "function") {
          throw new Error(`Statement for '${binding}' does not support bind`)
        }
        const preparedStmt = Reflect.apply(
          bindMethod,
          stmt,
          bindingsArray,
        ) as D1PreparedStatement
        let results
        const firstMethod = preparedStmt.first
        const allMethod = preparedStmt.all
        const runMethod = preparedStmt.run
        switch (action) {
          case "first":
            if (typeof firstMethod !== "function") {
              throw new Error(`Statement for '${binding}' does not support first`)
            }
            results = await Reflect.apply(firstMethod, preparedStmt, [])
            break
          case "all":
            if (typeof allMethod !== "function") {
              throw new Error(`Statement for '${binding}' does not support all`)
            }
            const allResult = await Reflect.apply(allMethod, preparedStmt, [])
            results =
              typeof allResult === "object" && allResult && "results" in allResult
                ? (allResult as { results: unknown }).results
                : allResult
            break
          case "run":
            if (typeof runMethod !== "function") {
              throw new Error(`Statement for '${binding}' does not support run`)
            }
            results = await Reflect.apply(runMethod, preparedStmt, [])
            break
        }
        return JSON.stringify(results)
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        return JSON.stringify({ error })
      }
    }
  }

  vm.eval('require "js"')

  const HostBridge = vm.eval("HostBridge")

  HostBridge.call("ts_call_binding=", vm.wrap(host.tsCallBinding))
  HostBridge.call("ts_run_d1_query=", vm.wrap(host.tsRunD1Query))
}

function toRubyStringLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
  return `"${escaped}"`
}

function buildQueryObject(
  searchParams: URLSearchParams,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  searchParams.forEach((_value, key) => {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      return
    }
    const values = searchParams.getAll(key)
    query[key] = values.length > 1 ? values : values[0] ?? ""
  })
  return query
}
