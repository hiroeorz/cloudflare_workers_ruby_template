declare module "*.wasm" {
  const module: WebAssembly.Module
  export default module
}

export interface Env {
  MY_KV: KVNamespace
}
