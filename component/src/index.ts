import type { Component } from "vue"
import type { ToolCallDisplay } from "./types"
import DiscoverAgents, { demoMock as discoverAgentsMock } from "./discover_agents/index.vue"
import Handoff, { demoMock as handoffMock } from "./handoff/index.vue"

type ToolComponent = Component<{ tool: ToolCallDisplay }>

const registry = (window as any).__MH_TOOL_REGISTRY__ as
  | {
      register: (name: string, component: ToolComponent) => void
      registerMock?: (name: string, mock: Record<string, unknown>) => void
    }
  | undefined

if (registry) {
  registry.register("discover_agents", DiscoverAgents as ToolComponent)
  registry.registerMock?.("discover_agents", discoverAgentsMock)

  registry.register("handoff", Handoff as ToolComponent)
  registry.registerMock?.("handoff", handoffMock)
} else {
  console.error(
    "[MH Tool Components] __MH_TOOL_REGISTRY__ not found on window. " +
      "Make sure the portal has initialized the global registry before loading this bundle.",
  )
}
