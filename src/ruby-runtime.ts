import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"

let rubyVmPromise: Promise<RubyVM> | null = null

const HELLO_SCRIPT = `
  # Ruby側でレスポンス文字列を生成
  "hello ruby ⚡️"
`

async function ensureRubyVM(): Promise<RubyVM> {
  if (!rubyVmPromise) {
    rubyVmPromise = (async () => {
      const moduleCandidate = rubyWasmAsset as unknown
      const module =
        moduleCandidate instanceof WebAssembly.Module
          ? moduleCandidate
          : await WebAssembly.compile(moduleCandidate as ArrayBuffer)

      const { vm } = await DefaultRubyVM(module, {
        consolePrint: false,
        env: {
          RUBYOPT: "--disable-did_you_mean",
        },
      })

      return vm
    })()
  }

  return rubyVmPromise
}

export async function runRubyHello(): Promise<string> {
  const vm = await ensureRubyVM()
  const result = vm.eval(HELLO_SCRIPT)
  return result.toString()
}
