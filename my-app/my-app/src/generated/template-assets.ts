import { setTemplateAssets, type TemplateAsset } from "@hibana-apps/runtime"
import template0 from "../../templates/index.html.erb"
import template1 from "../../templates/layouts/application.html.erb"

const templateAssets: TemplateAsset[] = [
  { filename: "templates/index.html.erb", source: template0 },
  { filename: "templates/layouts/application.html.erb", source: template1 },
]

setTemplateAssets(templateAssets)

export { templateAssets }
