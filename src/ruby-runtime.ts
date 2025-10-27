import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser"
import type { RubyVM } from "@ruby/wasm-wasi"
import rubyWasmAsset from "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm"

type HostGlobals = typeof globalThis & {
  tsAddNumbers?: (a: number, b: number) => string
}

let rubyVmPromise: Promise<RubyVM> | null = null

const HELLO_SCRIPT = `
  # Ruby側でTypeScript関数を呼び出して足し算結果を取得
  left = 1
  right = 3
  HostBridge.add_numbers(left, right)
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
        consolePrint: true,
        env: {
          RUBYOPT: "--disable-did_you_mean",
        },
      })

      registerHostFunctions(vm)

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

function registerHostFunctions(vm: RubyVM): void {
  const host = globalThis as HostGlobals

  if (typeof host.tsAddNumbers !== "function") {
    host.tsAddNumbers = (a: number, b: number): string => {
      const left = coerceToFiniteNumber(a, "a")
      const right = coerceToFiniteNumber(b, "b")
      const sum = left + right
      return `TypeScript sum result: ${sum}`
    }
  }

  vm.eval('require "js"')

  const bridgeModule = vm.eval(`
    module HostBridge
      class << self
        attr_accessor :ts_add

        def add_numbers(a, b)
          ts_add.apply(a, b)
        end
      end
    end
    HostBridge
  `)

  bridgeModule.call("ts_add=", vm.wrap(host.tsAddNumbers))
}

function coerceToFiniteNumber(value: unknown, label: string): number {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    throw new TypeError(`Invalid ${label} value: ${value}`)
  }
  return num
}
