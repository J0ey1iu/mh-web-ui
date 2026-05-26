import {
  getComponentSources,
  getComponentSource,
  addComponentSource as addSource,
  removeComponentSource as removeSource,
  type ComponentSource,
} from "./toolComponents.config"
import { registryVersion, setPendingSourceId, removeComponentsBySource } from "./toolCallRegistry"

export type SourceLoadState = "idle" | "loading" | "loaded" | "failed"

interface SourceStatus {
  state: SourceLoadState
  error: string | null
}

const sourceStatuses = new Map<string, SourceStatus>()
const promises = new Map<string, Promise<void>>()
const scriptElements = new Map<string, HTMLScriptElement>()

// Initialize statuses for default sources
for (const src of getComponentSources()) {
  sourceStatuses.set(src.id, { state: "idle", error: null })
}

export { getComponentSources, type ComponentSource }

export function getSourceStatus(id: string): SourceStatus {
  return sourceStatuses.get(id) ?? { state: "idle", error: null }
}

export function getSourceStates(): Map<string, SourceLoadState> {
  const states = new Map<string, SourceLoadState>()
  sourceStatuses.forEach((s, id) => states.set(id, s.state))
  return states
}

/**
 * Add a new component source and immediately start loading it.
 */
export async function addAndLoadSource(source: ComponentSource): Promise<void> {
  addSource(source)
  sourceStatuses.set(source.id, { state: "idle", error: null })
  await loadComponentSource(source.id)
}

/**
 * Remove a component source: unload its script, remove its registered components.
 */
export function unloadSource(id: string): void {
  // Remove script element
  const script = scriptElements.get(id)
  if (script && script.parentNode) {
    script.parentNode.removeChild(script)
  }
  scriptElements.delete(id)

  // Remove registered components from this source
  removeComponentsBySource(id)

  // Clean up internal state
  sourceStatuses.delete(id)
  promises.delete(id)

  // Remove from source list
  removeSource(id)
}

/**
 * Reload a source: clear its components, remove old script, re-load.
 */
export async function reloadSource(id: string): Promise<void> {
  // Clear old components from this source
  removeComponentsBySource(id)

  // Remove old script
  const script = scriptElements.get(id)
  if (script && script.parentNode) {
    script.parentNode.removeChild(script)
  }
  scriptElements.delete(id)

  // Reset status
  const status = sourceStatuses.get(id)
  if (status) {
    status.state = "idle"
    status.error = null
  } else {
    sourceStatuses.set(id, { state: "idle", error: null })
  }
  promises.delete(id)

  // Re-load
  await loadComponentSource(id)
}

export async function loadComponentSource(sourceId: string): Promise<void> {
  const src = getComponentSource(sourceId)
  if (!src) {
    throw new Error(`[ToolComponentLoader] Unknown component source: "${sourceId}"`)
  }

  let status = sourceStatuses.get(sourceId)
  if (!status) {
    status = { state: "idle", error: null }
    sourceStatuses.set(sourceId, status)
  }

  if (status.state === "loaded") return
  if (status.state === "failed") {
    status.error = null
    status.state = "idle"
  }

  if (status.state === "loading") {
    const p = promises.get(sourceId)
    if (p) await p
    return
  }

  status.state = "loading"
  const url = src.devUrl && typeof window !== "undefined" && window.location.hostname === "localhost"
    ? src.devUrl
    : src.url

  const promise = loadScript(url, sourceId)
  promises.set(sourceId, promise)

  try {
    await promise
    status.state = "loaded"
  } catch (err) {
    status.state = "failed"
    status.error = String(err)
    console.warn(`[ToolComponentLoader] Failed to load component source "${src.label}" from "${url}":`, err)
  }
}

export async function ensureComponentsLoaded(sourceId?: string): Promise<void> {
  if (sourceId) {
    return loadComponentSource(sourceId)
  }
  for (const src of getComponentSources()) {
    const status = sourceStatuses.get(src.id)
    if (!status || status.state !== "loaded") {
      await loadComponentSource(src.id)
    }
  }
}

export function getLoadError(sourceId?: string): string | null {
  if (sourceId) {
    return sourceStatuses.get(sourceId)?.error ?? null
  }
  const errors: string[] = []
  sourceStatuses.forEach((s) => {
    if (s.error) errors.push(s.error)
  })
  return errors.length > 0 ? errors.join("; ") : null
}

function loadScript(url: string, sourceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Remove existing script for this source (by ID, not URL)
    const existing = scriptElements.get(sourceId)
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing)
    }

    const versionBefore = registryVersion.value
    const script = document.createElement("script")
    script.src = url
    script.setAttribute("data-component-source", sourceId)

    scriptElements.set(sourceId, script)
    setPendingSourceId(sourceId)

    script.onload = () => {
      setPendingSourceId(null)
      if (registryVersion.value === versionBefore) {
        reject(
          new Error(
            `Bundle loaded from "${url}" but no components were registered`,
          ),
        )
      } else {
        resolve()
      }
    }
    script.onerror = () => {
      setPendingSourceId(null)
      reject(new Error(`Failed to load script: ${url}`))
    }
    document.head.appendChild(script)
  })
}
