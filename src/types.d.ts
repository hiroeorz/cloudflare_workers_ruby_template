declare module "*.wasm" {
  const module: WebAssembly.Module
  export default module
}

declare module "*.rb" {
  const content: string
  export default content
}

declare module "*app/**/*.rb" {
  const content: string
  export default content
}

declare module "../app/hibana/host_bridge.rb" {
  const content: string
  export default content
}

declare module "../app/helpers/application_helper.rb" {
  const content: string
  export default content
}

declare module "../app/hibana/d1_client.rb" {
  const content: string
  export default content
}

declare module "../app/hibana/r2_client.rb" {
  const content: string
  export default content
}

declare module "../app/hibana/routing.rb" {
  const content: string
  export default content
}

declare module "../app/app.rb" {
  const content: string
  export default content
}

declare module "@ruby/3.4-wasm-wasi/dist/ruby+stdlib.wasm" {
  const module: WebAssemblyModule
  export default module
}

declare module "*ruby+stdlib.wasm" {
  const module: WebAssemblyModule
  export default module
}

export interface Env {
  MY_KV: KVNamespace
  DB: D1Database
  MY_R2: R2Bucket
}

interface WebAssemblyModule {}
interface WebAssemblyNamespace {
  readonly Module: {
    prototype: WebAssemblyModule
    new (bytes: BufferSource): WebAssemblyModule
  }
  compile(bytes: BufferSource): Promise<WebAssemblyModule>
}

declare const WebAssembly: WebAssemblyNamespace
