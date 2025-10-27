declare module "*.wasm" {
  const module: WebAssembly.Module
  export default module
}

declare module "*.rb" {
  const content: string
  export default content
}

export interface Env {
  MY_KV: KVNamespace
  DB: D1Database
}
