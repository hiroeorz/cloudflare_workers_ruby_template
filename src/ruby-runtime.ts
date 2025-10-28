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
    sql: string,
    bindings: unknown[],
    action: "first" | "all" | "run",
  ) => Promise<string>
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
): Promise<string> {
  const vm = await setupRubyVM(env)
  const { pathname } = new URL(request.url)

  const context = vm.eval("RequestContext.new")
  const dispatcher = vm.eval("method(:dispatch)")
  const methodArg = vm.eval(toRubyStringLiteral(request.method))
  const pathArg = vm.eval(toRubyStringLiteral(pathname))
  const result = await dispatcher.callAsync("call", methodArg, pathArg, context)
  return result.toString()
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
      sql: string,
      bindings: unknown[],
      action: "first" | "all" | "run",
    ): Promise<string> => {
      try {
        const stmt = env.DB.prepare(sql)
        const bindingsArray = Array.isArray(bindings) ? bindings : [bindings]
        const preparedStmt = stmt.bind(...bindingsArray)
        let results
        switch (action) {
          case "first":
            results = await preparedStmt.first()
            break
          case "all":
            results = (await preparedStmt.all()).results
            break
          case "run":
            results = await preparedStmt.run()
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
