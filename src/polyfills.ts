// Cloudflare Workers 互換モードでは FinalizationRegistry が未実装なため、最低限の代替を用意
if (typeof globalThis.FinalizationRegistry === "undefined") {
  type CleanupCallback = (heldValue: unknown) => void

  class NoopFinalizationRegistry<T> {
    // コールバックは保持のみで利用しない（GC連動は不可）
    private readonly cleanup: CleanupCallback
    private readonly registry = new Map<T, unknown>()

    constructor(cleanup: CleanupCallback) {
      this.cleanup = cleanup
    }

    register(target: object, heldValue: T, unregisterToken?: object): void {
      this.registry.set(heldValue, unregisterToken ?? target)
    }

    unregister(unregisterToken: object): boolean {
      for (const [heldValue, token] of this.registry.entries()) {
        if (token === unregisterToken) {
          this.registry.delete(heldValue)
          return true
        }
      }
      return false
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).FinalizationRegistry = NoopFinalizationRegistry
}
