import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"
import hostBridgeScript from "../app/hibana/host_bridge.rb"
import contextScript from "../app/hibana/context.rb"
import hibanaHelperScript from "../app/helpers/application_helper.rb"
import d1ClientScript from "../app/hibana/d1_client.rb"
import r2ClientScript from "../app/hibana/r2_client.rb"
import routingScript from "../app/hibana/routing.rb"
import appScript from "../app/app.rb"

type HostGlobals = typeof globalThis & {
  tsKvPut?: (key: string, value: string) => Promise<void>
  tsKvGet?: (key: string) => Promise<string | null>
  tsR2Put?: (key: string, value: string) => Promise<void>
  tsR2Get?: (key: string) => Promise<string | null>
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
      await vm.evalAsync(hibanaHelperScript) // 4. ヘルパー
      await vm.evalAsync(d1ClientScript) // 5. D1クライアント
      await vm.evalAsync(r2ClientScript) // 6. R2クライアント
      await vm.evalAsync(routingScript) // 7. ルーティングDSL
      await vm.evalAsync(appScript) // 8. ルート定義

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

  // KVのput/get関数
  if (typeof host.tsKvPut !== "function") {
    host.tsKvPut = async (key: string, value: string): Promise<void> => {
      await env.MY_KV.put(key, value)
    }
  }
  if (typeof host.tsKvGet !== "function") {
    host.tsKvGet = async (key: string): Promise<string | null> => {
      return env.MY_KV.get(key)
    }
  }

  // R2のput/get関数
  if (typeof host.tsR2Put !== "function") {
    host.tsR2Put = async (key: string, value: string): Promise<void> => {
      await env.MY_R2.put(key, value)
    }
  }
  if (typeof host.tsR2Get !== "function") {
    host.tsR2Get = async (key: string): Promise<string | null> => {
      const object = await env.MY_R2.get(key)
      if (!object) {
        return null
      }
      return await object.text()
    }
  }

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

  HostBridge.call("ts_kv_put=", vm.wrap(host.tsKvPut))
  HostBridge.call("ts_kv_get=", vm.wrap(host.tsKvGet))
  HostBridge.call("ts_r2_put=", vm.wrap(host.tsR2Put))
  HostBridge.call("ts_r2_get=", vm.wrap(host.tsR2Get))
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
