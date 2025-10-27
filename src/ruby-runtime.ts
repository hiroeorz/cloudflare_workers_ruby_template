import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"
import hostBridgeScript from "../app/host_bridge.rb"
import hibanaAppScript from "../app/hibana/app.rb"
import routingScript from "../app/hibana/routing.rb"
import appScript from "../app/app.rb"

type HostGlobals = typeof globalThis & {
  tsKvPut?: (key: string, value: string) => Promise<void>
  tsKvGet?: (key: string) => Promise<string | null>
  tsRunD1Query?: (sql: string, bindings: unknown[]) => Promise<string>
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
      await vm.evalAsync(hibanaAppScript) // 3. アプリケーションロジック
      await vm.evalAsync(routingScript) // 4. ルーティングDSL
      await vm.evalAsync(appScript) // 5. ルート定義

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

  // Rubyのdispatch関数を呼び出す
  const context = vm.eval("{}") // シンプルなコンテキスト
  const result = await vm.evalAsync(
    `dispatch("${request.method}", "${pathname}", ${context})`,
  )
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

  // D1クエリを実行する汎用的な非同期関数
  if (typeof host.tsRunD1Query !== "function") {
    host.tsRunD1Query = async (
      sql: string,
      bindings: unknown[],
    ): Promise<string> => {
      try {
        const stmt = env.DB.prepare(sql)
        const bindingsArray = Array.isArray(bindings) ? bindings : [bindings]
        const { results } = await stmt.bind(...bindingsArray).all()
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
  HostBridge.call("ts_run_d1_query=", vm.wrap(host.tsRunD1Query))
}
