import { ref } from "vue"
import type { Component } from "vue"
import type { ToolCallComponentProps } from "./types"
import ToolCallCard from "./components/ToolCallCard.vue"

type ToolCallComponent = Component<ToolCallComponentProps>

interface RegistryEntry {
  component: ToolCallComponent
  sourceId: string
}

export interface ComponentDemoMock {
  status?: "running" | "success" | "error"
  progress?: string
  result?: string
  meta?: string
}

const registry = new Map<string, RegistryEntry>()
const demoMocks = new Map<string, ComponentDemoMock>()
export const registryVersion = ref(0)

let pendingSourceId: string | null = null

export function setPendingSourceId(sourceId: string | null) {
  pendingSourceId = sourceId
}

function currentScriptSourceId(): string | null {
  return document.currentScript?.getAttribute("data-component-source") ?? null
}

export function registerToolCallComponent(name: string, component: ToolCallComponent, sourceId?: string) {
  const src = sourceId ?? pendingSourceId ?? currentScriptSourceId() ?? "unknown"
  registry.set(name, { component, sourceId: src })
  registryVersion.value++
}

export function removeComponentsBySource(sourceId: string): void {
  const names: string[] = []
  registry.forEach((entry, name) => {
    if (entry.sourceId === sourceId) names.push(name)
  })
  for (const name of names) {
    registry.delete(name)
    demoMocks.delete(name)
  }
  if (names.length > 0) registryVersion.value++
}

export function setComponentDemoMock(name: string, mock: ComponentDemoMock) {
  demoMocks.set(name, mock)
}

export function getComponentDemoMock(name: string): ComponentDemoMock | undefined {
  return demoMocks.get(name)
}

export function getAllDemoMocks(): Map<string, ComponentDemoMock> {
  return new Map(demoMocks)
}

export function getToolCallComponent(name: string): ToolCallComponent {
  if (!registry.has(name)) {
    console.warn(`[toolCallRegistry] No component registered for tool "${name}", falling back to default`)
  }
  return registry.get(name)?.component ?? ToolCallCard
}

export function getRegisteredComponent(name: string): ToolCallComponent | undefined {
  return registry.get(name)?.component
}

export function getComponentSource(name: string): string | undefined {
  return registry.get(name)?.sourceId
}

export function isToolCallComponentRegistered(name: string): boolean {
  return registry.has(name)
}

export interface RegisteredComponentInfo {
  name: string
  sourceId: string
}

export function getAllRegisteredComponents(): RegisteredComponentInfo[] {
  const result: RegisteredComponentInfo[] = []
  registry.forEach((entry, name) => {
    result.push({ name, sourceId: entry.sourceId })
  })
  return result
}

;(window as any).__MH_TOOL_REGISTRY__ = {
  register: registerToolCallComponent,
  get: getToolCallComponent,
  registerMock: setComponentDemoMock,
}
