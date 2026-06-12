import type { AgentInfo, FetchListParams, GeneratedAgent, GeneratedTool, ManageAgent, ManageScenario, ManageTool, MessageItem, PaginatedResponse, ScenarioDetail, ScenarioInfo, SessionInfo, UserInfo, SSEEventName } from "../types"
import { appConfig } from "../config"

function fillUrl(template: string, params?: Record<string, string>): string {
  if (!params) return template
  let result = template
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, encodeURIComponent(value))
  }
  return result
}

function getLocale(): string {
  if (typeof localStorage !== "undefined") return localStorage.getItem("locale") || "zh"
  return "zh"
}

export { getLocale }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }
  let res: Response
  try {
    res = await fetch(url, { credentials: "include", ...options, headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) } })
    if (res.status === 401) {
      if (appConfig.loginUrl) {
        window.location.replace(`${appConfig.loginUrl}?redirect=${encodeURIComponent(window.location.href)}`)
      }
      throw new Error("Unauthorized")
    }
    if (res.status === 403) throw new Error("Forbidden: permission denied")
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof TypeError) throw new Error("Backend is not available")
    throw err
  }
}

export async function fetchMe(): Promise<UserInfo> {
  return request<UserInfo>(appConfig.apiAuthMe)
}

export async function fetchSessions(scenarioId?: string): Promise<SessionInfo[]> {
  let u = appConfig.apiSessions
  if (scenarioId) u += `?scenario_id=${encodeURIComponent(scenarioId)}`
  return request<SessionInfo[]>(u)
}

export async function createSession(agentName: string = "triage", scenarioId?: string): Promise<SessionInfo> {
  const body: Record<string, unknown> = { agent_name: agentName }
  if (scenarioId) body.scenario_id = scenarioId
  return request<SessionInfo>(appConfig.apiSessions, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function deleteSession(memoryId: string): Promise<void> {
  await request<{ ok: boolean }>(fillUrl(appConfig.apiSession, { id: memoryId }), { method: "DELETE" })
}

export async function fetchMessages(memoryId: string): Promise<MessageItem[]> {
  return request<MessageItem[]>(fillUrl(appConfig.apiSessionMessages, { id: memoryId }))
}

export async function fetchScenarios(): Promise<ScenarioInfo[]> {
  return request<ScenarioInfo[]>(appConfig.apiScenarios)
}

export async function fetchScenarioDetail(scenarioId: string): Promise<ScenarioDetail> {
  return request<ScenarioDetail>(fillUrl(appConfig.apiScenarioDetail, { id: scenarioId }))
}

export async function fetchAgents(scenarioId?: string): Promise<AgentInfo[]> {
  let u = appConfig.apiAgents
  if (scenarioId) u += `?scenario=${encodeURIComponent(scenarioId)}`
  return request<AgentInfo[]>(u)
}

async function consumeSSE(response: Response, onLine: (line: string) => void): Promise<void> {
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      onLine(line)
    }
  }
}

export type SSEEventCallback = (event: SSEEventName, data: any) => void

export function streamChat(memoryId: string, message: string, onEvent: SSEEventCallback, onDone: () => void, onError: (err: Error) => void): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }
  let eventName = ""

  fetch(fillUrl(appConfig.apiChat, { id: memoryId }), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ message }),
    signal: controller.signal,
  })
    .then(async (res) => {
      await consumeSSE(res, (line) => {
        if (line.startsWith("event: ")) eventName = line.slice(7).trim()
        else if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim()
          try { const data = JSON.parse(dataStr); onEvent(eventName as SSEEventName, data) } catch {}
        }
      })
      onDone()
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err instanceof Error ? err : new Error(String(err)))
    })

  return controller
}

export function generateToolMetadata(
  description: string,
  onEvent: (type: string, data: any) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }

  fetch(appConfig.apiToolGeneratorGenerate, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ natural_description: description }),
    signal: controller.signal,
  })
    .then(async (res) => {
      await consumeSSE(res, (line) => {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim()
          try {
            const payload = JSON.parse(dataStr)
            onEvent(payload.type as string, payload.data)
          } catch { /* skip */ }
        }
      })
      onDone()
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err instanceof Error ? err : new Error(String(err)))
    })

  return controller
}

export async function fetchGeneratedTools(): Promise<GeneratedTool[]> {
  return request<GeneratedTool[]>(appConfig.apiToolGeneratorTools)
}

export async function saveGeneratedTool(tool: {
  name: string
  display_name: string
  description: string
  parameters: Record<string, any>
  source_code: string
}): Promise<GeneratedTool> {
  return request<GeneratedTool>(appConfig.apiToolGeneratorTools, {
    method: "POST",
    body: JSON.stringify(tool),
  })
}

export async function updateGeneratedTool(
  name: string,
  tool: {
    display_name: string
    description: string
    parameters: Record<string, any>
    source_code: string
  },
): Promise<GeneratedTool> {
  return request<GeneratedTool>(fillUrl(`${appConfig.apiToolGeneratorTools}/${name}`, {}), {
    method: "PUT",
    body: JSON.stringify(tool),
  })
}

export async function deleteGeneratedTool(name: string): Promise<void> {
  await request<{ status: string }>(fillUrl(`${appConfig.apiToolGeneratorTools}/${name}`, {}), { method: "DELETE" })
}

export function executeGeneratedTool(
  name: string,
  args: Record<string, any>,
  sourceCode: string,
  onEvent: (type: string, data: any) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }

  fetch(fillUrl(appConfig.apiGeneratedToolTrial, { name }), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ args, source_code: sourceCode }),
    signal: controller.signal,
  })
    .then(async (res) => {
      await consumeSSE(res, (line) => {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim()
          try {
            const payload = JSON.parse(dataStr)
            onEvent(payload.type as string, payload.data)
          } catch { /* skip */ }
        }
      })
      onDone()
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err instanceof Error ? err : new Error(String(err)))
    })

  return controller
}

// ── Agent Generator ──

export function generateAgentMetadata(
  description: string,
  onEvent: (type: string, data: any) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }

  fetch(appConfig.apiAgentGeneratorGenerate, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ natural_description: description }),
    signal: controller.signal,
  })
    .then(async (res) => {
      await consumeSSE(res, (line) => {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim()
          try {
            const payload = JSON.parse(dataStr)
            onEvent(payload.type as string, payload.data)
          } catch { /* skip */ }
        }
      })
      onDone()
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err instanceof Error ? err : new Error(String(err)))
    })

  return controller
}

export async function fetchGeneratedAgents(): Promise<GeneratedAgent[]> {
  return request<GeneratedAgent[]>(appConfig.apiAgentGeneratorAgents)
}

export async function saveGeneratedAgent(agent: {
  name: string
  display_name: string
  description: string
  system_prompt: string
  provider?: string
  model?: string
  llm_config?: Record<string, any>
}): Promise<GeneratedAgent> {
  return request<GeneratedAgent>(appConfig.apiAgentGeneratorAgents, {
    method: "POST",
    body: JSON.stringify(agent),
  })
}

export async function updateGeneratedAgent(
  name: string,
  agent: {
    display_name: string
    description: string
    system_prompt: string
    provider?: string
    model?: string
    llm_config?: Record<string, any>
  },
): Promise<GeneratedAgent> {
  return request<GeneratedAgent>(fillUrl(`${appConfig.apiAgentGeneratorAgents}/${name}`, {}), {
    method: "PUT",
    body: JSON.stringify(agent),
  })
}

export async function deleteGeneratedAgent(name: string): Promise<void> {
  await request<{ status: string }>(fillUrl(`${appConfig.apiAgentGeneratorAgents}/${name}`, {}), { method: "DELETE" })
}

export function executeAgentTrial(
  name: string,
  message: string,
  systemPrompt: string,
  provider: string,
  model: string,
  llmConfig: Record<string, any>,
  onEvent: (type: string, data: any) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }

  fetch(fillUrl(appConfig.apiAgentGeneratorTrial, { name }), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ message, system_prompt: systemPrompt, provider, model, llm_config: llmConfig }),
    signal: controller.signal,
  })
    .then(async (res) => {
      await consumeSSE(res, (line) => {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim()
          try {
            const payload = JSON.parse(dataStr)
            onEvent(payload.type as string, payload.data)
          } catch { /* skip */ }
        }
      })
      onDone()
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err instanceof Error ? err : new Error(String(err)))
    })

  return controller
}

// ── Management CRUD ──
// Silent-403 helpers: if the user lacks manage:* for a resource, return empty/null
// instead of showing an intrusive alert. Mutations still throw on 403.

function buildListUrl(base: string, params?: FetchListParams): string {
  if (!params) return base
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.page != null) query.set("page", String(params.page))
  if (params.page_size != null) query.set("page_size", String(params.page_size))
  const qs = query.toString()
  return qs ? `${base}?${qs}` : base
}

async function fetchManageOrEmpty<T>(url: string, params?: FetchListParams): Promise<PaginatedResponse<T>> {
  try {
    return await request<PaginatedResponse<T>>(buildListUrl(url, params))
  } catch (e) {
    if (e instanceof Error && e.message.includes("permission denied"))
      return { items: [], total: 0, page: params?.page ?? 1, page_size: params?.page_size ?? 15 }
    throw e
  }
}

export async function fetchManageScenarios(params?: FetchListParams): Promise<PaginatedResponse<ManageScenario>> {
  return fetchManageOrEmpty<ManageScenario>(appConfig.apiManagementScenarios, params)
}

export async function fetchManageScenario(scenarioId: string): Promise<ManageScenario> {
  return request<ManageScenario>(fillUrl(appConfig.apiManagementScenario, { id: scenarioId }))
}

export async function createManageScenario(scenario: Partial<ManageScenario>): Promise<ManageScenario> {
  return request<ManageScenario>(appConfig.apiManagementScenarios, {
    method: "POST",
    body: JSON.stringify(scenario),
  })
}

export async function updateManageScenario(scenarioId: string, scenario: Partial<ManageScenario>): Promise<ManageScenario> {
  return request<ManageScenario>(fillUrl(appConfig.apiManagementScenario, { id: scenarioId }), {
    method: "PUT",
    body: JSON.stringify(scenario),
  })
}

export async function deleteManageScenario(scenarioId: string): Promise<void> {
  await request(fillUrl(appConfig.apiManagementScenario, { id: scenarioId }), { method: "DELETE" })
}

export async function fetchManageAgents(params?: FetchListParams): Promise<PaginatedResponse<ManageAgent>> {
  return fetchManageOrEmpty<ManageAgent>(appConfig.apiManagementAgents, params)
}

export async function createManageAgent(agent: Partial<ManageAgent>): Promise<ManageAgent> {
  return request<ManageAgent>(appConfig.apiManagementAgents, {
    method: "POST",
    body: JSON.stringify(agent),
  })
}

export async function updateManageAgent(name: string, agent: Partial<ManageAgent>): Promise<ManageAgent> {
  return request<ManageAgent>(fillUrl(appConfig.apiManagementAgent, { name }), {
    method: "PUT",
    body: JSON.stringify(agent),
  })
}

export async function deleteManageAgent(name: string): Promise<void> {
  await request(fillUrl(appConfig.apiManagementAgent, { name }), { method: "DELETE" })
}

export async function fetchProviders(): Promise<string[]> {
  return request<string[]>(appConfig.apiManagementProviders)
}

export async function fetchManageTools(params?: FetchListParams): Promise<PaginatedResponse<ManageTool>> {
  return fetchManageOrEmpty<ManageTool>(appConfig.apiManagementTools, params)
}

export async function createManageTool(tool: Partial<ManageTool>): Promise<ManageTool> {
  return request<ManageTool>(appConfig.apiManagementTools, {
    method: "POST",
    body: JSON.stringify(tool),
  })
}

export async function updateManageTool(name: string, tool: Partial<ManageTool>): Promise<ManageTool> {
  return request<ManageTool>(fillUrl(appConfig.apiManagementTool, { name }), {
    method: "PUT",
    body: JSON.stringify(tool),
  })
}

export async function deleteManageTool(name: string): Promise<void> {
  await request(fillUrl(appConfig.apiManagementTool, { name }), { method: "DELETE" })
}

// ── Relationship management ──

export async function addScenarioAgent(scenarioId: string, agentName: string, toolNames?: string[]): Promise<ManageScenario> {
  return request<ManageScenario>(fillUrl(`${appConfig.apiManagementScenarios}/{id}/agents`, { id: scenarioId }), {
    method: "POST",
    body: JSON.stringify({ agent_name: agentName, tool_names: toolNames ?? [] }),
  })
}

export async function removeScenarioAgent(scenarioId: string, agentName: string): Promise<ManageScenario> {
  return request<ManageScenario>(fillUrl(`${appConfig.apiManagementScenarios}/{id}/agents/{name}`, { id: scenarioId, name: agentName }), {
    method: "DELETE",
  })
}

export async function addAgentTool(scenarioId: string, agentName: string, toolName: string): Promise<ManageScenario> {
  return request<ManageScenario>(fillUrl(`${appConfig.apiManagementScenarios}/{id}/agents/{a}/tools`, { id: scenarioId, a: agentName }), {
    method: "POST",
    body: JSON.stringify({ tool_name: toolName }),
  })
}

export async function removeAgentTool(scenarioId: string, agentName: string, toolName: string): Promise<ManageScenario> {
  return request<ManageScenario>(fillUrl(`${appConfig.apiManagementScenarios}/{id}/agents/{a}/tools/{t}`, { id: scenarioId, a: agentName, t: toolName }), {
    method: "DELETE",
  })
}
