import { setStaticAssets, type StaticAsset } from "@hibana-apps/runtime"

const staticAssets: StaticAsset[] = [
  { filename: "public/assets/app.css", body: ":root {\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n\nbody {\n  margin: 2rem;\n  color: #0f172a;\n}\n", contentType: "text/css; charset=UTF-8" },
  { filename: "public/assets/logo.svg", body: "<svg width=\"128\" height=\"128\" viewBox=\"0 0 128 128\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect width=\"128\" height=\"128\" rx=\"20\" fill=\"#111827\"/>\n  <path d=\"M64 20L80 72H48L64 108\" stroke=\"#F472B6\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>\n", contentType: "image/svg+xml" },
  { filename: "public/index.html", body: "<!doctype html>\n<html lang=\"ja\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>Hibana Static Page</title>\n    <link rel=\"stylesheet\" href=\"/assets/app.css\" />\n  </head>\n  <body>\n    <h1>Hibana Static Assets</h1>\n    <p>このHTMLは <code>public/index.html</code> から直接配信されています。</p>\n    <img src=\"/assets/logo.svg\" alt=\"Logo\" width=\"120\" />\n  </body>\n</html>\n", contentType: "text/html; charset=UTF-8" },
]

setStaticAssets(staticAssets)

export { staticAssets }
