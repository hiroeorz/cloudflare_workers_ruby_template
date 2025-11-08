import { setStaticAssets, type StaticAsset } from "@hibana-apps/runtime"
import asset0 from "../../public/assets/app.css"
import asset1 from "../../public/assets/logo.svg"
import asset2 from "../../public/index.html"

const staticAssets: StaticAsset[] = [
  { filename: "public/assets/app.css", body: asset0, contentType: "text/css; charset=UTF-8" },
  { filename: "public/assets/logo.svg", body: asset1, contentType: "image/svg+xml" },
  { filename: "public/index.html", body: asset2, contentType: "text/html; charset=UTF-8" },
]

setStaticAssets(staticAssets)

export { staticAssets }
