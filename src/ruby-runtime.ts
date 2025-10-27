import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"
import type { Env } from "./types.d.ts"

type HostGlobals = typeof globalThis & {
  tsAccessKV?: (key: string, value: string) => Promise<string>
  tsAccessD1?: (id: number) => Promise<string>
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
  # D1からID 1 の投稿を取得する
  post_id = 1
  HostBridge.access_d1(post_id).await
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

  // D1にアクセスする非同期関数
  if (typeof host.tsAccessD1 !== "function") {
    host.tsAccessD1 = async (id: number): Promise<string> => {
      const stmt = env.DB.prepare("SELECT content FROM posts WHERE id = ?")
      const result = await stmt.bind(id).first<{ content: string }>()
      if (result) {
        return `D1から取得(id: ${id}): ${result.content}`
      }
      return `D1にid: ${id}のデータはありませんでした。`
    }
  }

  vm.eval('require "js"')

  const bridgeModule = vm.eval(`
    module HostBridge
      class << self
        attr_accessor :ts_kv, :ts_d1

        def access_kv(key, value)
          ts_kv.apply(key, value).await
        end

        def access_d1(id)
          ts_d1.apply(id).await
        end
      end
    end
    HostBridge
  `)

  bridgeModule.call("ts_kv=", vm.wrap(host.tsAccessKV))
  bridgeModule.call("ts_d1=", vm.wrap(host.tsAccessD1))
}
