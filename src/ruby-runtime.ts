import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"

type HostGlobals = typeof globalThis & {
  tsAccessKV?: (key: string, value: string) => Promise<string>
  tsRunD1Query?: (sql: string, bindings: unknown[]) => Promise<string>
}

let rubyVmPromise: Promise<RubyVM> | null = null

const KV_TEST_SCRIPT = `
  # Ruby側でKVを操作するTypeScript関数を呼び出す
  key = "ruby-wasm-key"
  value = "Hello from Ruby! 👋"

  # tsAccessKV は Promise を返すので .await で待つ
  HostBridge.access_kv(key, value).await
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

  // KVにアクセスする非同期関数
  if (typeof host.tsAccessKV !== "function") {
    host.tsAccessKV = async (key: string, value: string): Promise<string> => {
      await env.MY_KV.put(key, value)
      const readValue = await env.MY_KV.get(key)
      return `Wrote '${value}' to KV. Read back: '${readValue}'.`
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
        attr_accessor :ts_kv, :ts_run_d1_query

        def access_kv(key, value)
          ts_kv.apply(key, value).await
        end

        def run_d1_query(sql, bindings)
          ts_run_d1_query.apply(sql, bindings).await
        end
      end
    end
    HostBridge
  `)

  bridgeModule.call("ts_kv=", vm.wrap(host.tsAccessKV))
  bridgeModule.call("ts_run_d1_query=", vm.wrap(host.tsRunD1Query))
}
