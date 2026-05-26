import { ref } from "vue"

export interface ComponentSource {
  id: string
  label: string
  url: string
  devUrl?: string
}

const sources = ref<ComponentSource[]>([
  { id: "builtin", label: "Built-in Components", url: "/component/mh-tool-components.umd.js" },
  { id: "extra", label: "Extra Components", url: "/component/mh-extra-components.umd.js" },
])

export function getComponentSources(): ComponentSource[] {
  return sources.value
}

export function setComponentSources(newSources: ComponentSource[]): void {
  sources.value = newSources
}

export function addComponentSource(source: ComponentSource): void {
  if (sources.value.some(s => s.id === source.id)) return
  sources.value = [...sources.value, source]
}

export function removeComponentSource(id: string): void {
  sources.value = sources.value.filter(s => s.id !== id)
}

export function getComponentSource(id: string): ComponentSource | undefined {
  return sources.value.find(s => s.id === id)
}
