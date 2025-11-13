import type { RubyScript } from "@hibana-apps/runtime"
import { createDurableObjectClass } from "@hibana-apps/runtime"
import durableScript0 from "../../app/durable/counter.rb"

export const durableScripts: RubyScript[] = [
  { filename: "app/durable/counter.rb", source: durableScript0 },
]

export const durableObjectBindings = [
  { binding: "COUNTER", className: "Counter", exportName: "Counter" },
] as const

export const Counter = createDurableObjectClass("COUNTER")
