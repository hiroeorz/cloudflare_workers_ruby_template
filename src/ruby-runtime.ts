import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"

type HostGlobals = typeof globalThis & {
  tsKvPut?: (key: string, value: string) => Promise<void>
  tsKvGet?: (key: string) => Promise<string | null>
  tsRunD1Query?: (sql: string, bindings: unknown[]) => Promise<string>
}

let rubyVmPromise: Promise<RubyVM> | null = null

const KV_TEST_SCRIPT = `
  key = "ruby-kv-key"
  value = "Hello from separated KV functions!"

  # 1. putで値を書き込む
  HostBridge.kv_put(key, value).await

  # 2. getで値を読み込む
  read_value = HostBridge.kv_get(key).await

  # 3. 結果を文字列として組み立てる
  "Wrote '#{value}' to KV. Read back: '#{read_value}'"
`

const D1_TEST_SCRIPT = `
  # Ruby側でSQLとバインド値を定義
  sql = "SELECT id, content FROM posts WHERE id = ?"
  bindings = [1]

  # TypeScript側の関数を呼び出し、結果(JSON文字列)を待つ
  HostBridge.run_d1_query(sql, bindings).await
`

async function ensureRubyVM(env: Env): Promise<RubyVM> {
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

      registerHostFunctions(vm, env)

      return vm
    })()
  }

  return rubyVmPromise
}

export async function runRubyKVTest(env: Env): Promise<string> {
  const vm = await ensureRubyVM(env)
  const result = await vm.evalAsync(KV_TEST_SCRIPT)
  return result.toString()
}

export async function runRubyD1Test(env: Env): Promise<string> {
  const vm = await ensureRubyVM(env)
  const result = await vm.evalAsync(D1_TEST_SCRIPT)
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
    host.tsRunD1Query = async (sql: string, bindings: unknown[]): Promise<string> => {
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

  const bridgeModule = vm.eval(`
    module HostBridge
      class << self
        attr_accessor :ts_kv_put, :ts_kv_get, :ts_run_d1_query

        def kv_put(key, value)
          ts_kv_put.apply(key, value).await
        end

        def kv_get(key)
          ts_kv_get.apply(key).await
        end

        def run_d1_query(sql, bindings)
          ts_run_d1_query.apply(sql, bindings).await
        end
      end
    end
    HostBridge
  `)

  bridgeModule.call("ts_kv_put=", vm.wrap(host.tsKvPut))
  bridgeModule.call("ts_kv_get=", vm.wrap(host.tsKvGet))
  bridgeModule.call("ts_run_d1_query=", vm.wrap(host.tsRunD1Query))
}
