import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM, RubyObject } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"
import rubyScript from "../app/app.rb"
import hostBridgeScript from "../app/host_bridge.rb"

type HostGlobals = typeof globalThis & {
  tsKvPut?: (key: string, value: string) => Promise<void>
  tsKvGet?: (key: string) => Promise<string | null>
  tsRunD1Query?: (sql: string, bindings: unknown[]) => Promise<string>
}

let rubyAppPromise: Promise<RubyObject> | null = null

async function ensureRubyApp(env: Env): Promise<RubyObject> {
  if (!rubyAppPromise) {
    rubyAppPromise = (async () => {
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

      // ブリッジを先に評価する
      await vm.evalAsync(hostBridgeScript)

      registerHostFunctions(vm, env)

      // app.rbを評価し、Hibana::Appのインスタンスを返す
      return vm.evalAsync(rubyScript)
    })()
  }
  return rubyAppPromise
}

export async function runRubyKVTest(env: Env): Promise<string> {
  const rubyApp = await ensureRubyApp(env)
  const result = await rubyApp.callAsync("run_kv_test")
  return result.toString()
}

export async function runRubyD1Test(env: Env): Promise<string> {
  const rubyApp = await ensureRubyApp(env)
  const result = await rubyApp.callAsync("run_d1_test")
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
