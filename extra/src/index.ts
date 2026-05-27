import type { Component } from "vue"
import type { ToolCallDisplay } from "./types"
import Calculate, { demoMock as calculateMock } from "./calculate/index.vue"
import GetCurrentTime, { demoMock as getCurrentTimeMock } from "./get_current_time/index.vue"
import ShowUiMeta, { demoMock as showUiMetaMock } from "./show_ui_meta/index.vue"
import GeneralViz, { demoMock as generalVizMock } from "./general_viz/index.vue"

type ToolComponent = Component<{ tool: ToolCallDisplay }>

interface RegistryAPI {
  register: (name: string, component: ToolComponent, options?: { autoCollapsible?: boolean }) => void
  registerMock?: (name: string, mock: Record<string, unknown>) => void
}

const registry = (window as any).__MH_TOOL_REGISTRY__ as RegistryAPI | undefined

if (registry) {
  registry.register("calculator", Calculate as ToolComponent)
  registry.registerMock?.("calculator", calculateMock)

  registry.register("current_time", GetCurrentTime as ToolComponent)
  registry.registerMock?.("current_time", getCurrentTimeMock)

  registry.register("show_ui_meta", ShowUiMeta as ToolComponent)
  registry.registerMock?.("show_ui_meta", showUiMetaMock)

  registry.register("general_visualization", GeneralViz as ToolComponent, { autoCollapsible: false })
  registry.registerMock?.("general_visualization", generalVizMock)
} else {
  console.error(
    "[MH Extra Tool Components] __MH_TOOL_REGISTRY__ not found on window. " +
      "Make sure the portal has initialized the global registry before loading this bundle.",
  )
}
