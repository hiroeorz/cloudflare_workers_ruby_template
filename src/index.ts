import "@hibana/runtime/polyfills"
import {
  runtimeFetch,
  setApplicationScripts,
  type Env,
} from "@hibana/runtime"
import appMain from "../app/app.rb"
import "./generated/helper-scripts"

setApplicationScripts([
  { filename: "app/app.rb", source: appMain },
])

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return runtimeFetch(request, env)
  },
}
