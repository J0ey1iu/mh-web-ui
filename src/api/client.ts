import type { AgentInfo, FetchListParams, FeedbackSubmitRequest, FeedbackResponse, ManageAgent, ManageFeedbackItem, FeedbackSessionResponse, FeedbackStateItem, ManageProvider, ManageScenario, ManageTool, MessagesResponse, MetricsQuery, MetricsSummary, PaginatedResponse, ProviderModel, ScenarioDetail, ScenarioInfo, SessionInfo, UserInfo, SSEEventName } from "../types"
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

export function compactSession(
  memoryId: string,
  onEvent: SSEEventCallback,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }
  let eventName = ""

  fetch(fillUrl(appConfig.apiSessionCompact, { id: memoryId }), {
    method: "POST",
    credentials: "include",
    headers,
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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Accept-Language": getLocale() }
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }
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

export async function fetchMessages(memoryId: string): Promise<MessagesResponse> {
  return request<MessagesResponse>(fillUrl(appConfig.apiSessionMessages, { id: memoryId }))
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

export async function fetchAgentTypes(): Promise<any[]> {
  return request<any[]>(appConfig.apiManagementAgentTypes)
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

export async function deleteManageTool(name: string, force = false): Promise<void | { usages: { scenario_id: string; agent_name: string }[] }> {
  const url = fillUrl(appConfig.apiManagementTool, { name }) + (force ? "?force=true" : "")
  const headers: Record<string, string> = { "Accept-Language": getLocale() }
  const res = await fetch(url, { method: "DELETE", credentials: "include", headers })
  if (res.status === 409) {
    const body = await res.json()
    const err = new Error("TOOL_IN_USE")
    ;(err as any).usages = body?.detail?.usages ?? []
    throw err
  }
  if (res.status === 401) {
    if (appConfig.loginUrl) window.location.replace(`${appConfig.loginUrl}?redirect=${encodeURIComponent(window.location.href)}`)
    throw new Error("Unauthorized")
  }
  if (res.status === 403) throw new Error("Forbidden: permission denied")
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
}

// ── Tool Upload ──

export interface UploadToolResult {
  tool: Record<string, any>
  name: string
  script_path: string
}

export interface UploadToolsResponse {
  created: UploadToolResult[]
  errors: { filename: string; error: string }[]
}

export async function uploadToolScript(file: File, overwrite = false): Promise<UploadToolResult> {
  const form = new FormData()
  form.append("file", file)
  return request<UploadToolResult>(`${appConfig.apiManagementTools}/upload?overwrite=${overwrite}`, {
    method: "POST",
    body: form,
  })
}

export async function uploadToolScripts(files: File[], overwrite = false): Promise<UploadToolsResponse> {
  const form = new FormData()
  files.forEach(f => form.append("files", f))
  return request<UploadToolsResponse>(`${appConfig.apiManagementTools}/upload-batch?overwrite=${overwrite}`, {
    method: "POST",
    body: form,
  })
}

// ── Provider Configs ──

export async function fetchManageProviderConfigs(params?: FetchListParams): Promise<PaginatedResponse<ManageProvider>> {
  return fetchManageOrEmpty<ManageProvider>(appConfig.apiManagementProviderConfigs, params)
}

export async function fetchManageProviderConfig(name: string): Promise<ManageProvider> {
  return request<ManageProvider>(fillUrl(appConfig.apiManagementProviderConfig, { name }))
}

export async function createManageProviderConfig(provider: Partial<ManageProvider>): Promise<ManageProvider> {
  return request<ManageProvider>(appConfig.apiManagementProviderConfigs, {
    method: "POST",
    body: JSON.stringify(provider),
  })
}

export async function updateManageProviderConfig(name: string, provider: Partial<ManageProvider>): Promise<ManageProvider> {
  return request<ManageProvider>(fillUrl(appConfig.apiManagementProviderConfig, { name }), {
    method: "PUT",
    body: JSON.stringify(provider),
  })
}

export async function deleteManageProviderConfig(name: string): Promise<void> {
  await request(fillUrl(appConfig.apiManagementProviderConfig, { name }), { method: "DELETE" })
}

// ── Feedback ──

export async function submitFeedback(
  data: FeedbackSubmitRequest
): Promise<FeedbackResponse> {
  return request<FeedbackResponse>(appConfig.apiFeedback, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function fetchSessionFeedback(sessionId: string): Promise<FeedbackStateItem[]> {
  const url = `${appConfig.apiFeedback}?session_id=${encodeURIComponent(sessionId)}`
  return request<FeedbackStateItem[]>(url)
}

export async function fetchManageFeedback(
  params?: FetchListParams & {
    feedback_type?: string
    source?: string
    status?: string
    date_from?: string
    date_to?: string
  }
): Promise<PaginatedResponse<ManageFeedbackItem>> {
  const query = new URLSearchParams()
  if (params?.q) query.set("q", params.q)
  if (params?.page != null) query.set("page", String(params.page))
  if (params?.page_size != null) query.set("page_size", String(params.page_size))
  if (params?.feedback_type) query.set("feedback_type", params.feedback_type)
  if (params?.source) query.set("source", params.source)
  if (params?.status) query.set("status", params.status)
  if (params?.date_from) query.set("date_from", params.date_from)
  if (params?.date_to) query.set("date_to", params.date_to)
  const qs = query.toString()
  const url = qs ? `${appConfig.apiManagementFeedback}?${qs}` : appConfig.apiManagementFeedback
  return fetchManageOrEmpty<ManageFeedbackItem>(url)
}

export async function fetchFeedbackSession(
  feedbackId: string
): Promise<FeedbackSessionResponse> {
  return request<FeedbackSessionResponse>(
    appConfig.apiManagementFeedbackSession.replace("{id}", encodeURIComponent(feedbackId))
  )
}

export async function deleteManageFeedback(feedbackId: string): Promise<void> {
  await request(
    `${appConfig.apiManagementFeedback}/${encodeURIComponent(feedbackId)}`,
    { method: "DELETE" }
  )
}

export async function deleteManageFeedbackBatch(ids: string[]): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(
    appConfig.apiManagementFeedbackBatchDelete,
    {
      method: "POST",
      body: JSON.stringify({ ids }),
    }
  )
}

export async function updateFeedbackStatus(feedbackId: string, status: string): Promise<ManageFeedbackItem> {
  return request<ManageFeedbackItem>(
    `${appConfig.apiManagementFeedback}/${encodeURIComponent(feedbackId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  )
}

export function getFeedbackExportUrl(
  params?: {
    q?: string
    feedback_type?: string
    source?: string
    status?: string
    date_from?: string
    date_to?: string
  }
): string {
  const query = new URLSearchParams()
  if (params?.q) query.set("q", params.q)
  if (params?.feedback_type) query.set("feedback_type", params.feedback_type)
  if (params?.source) query.set("source", params.source)
  if (params?.status) query.set("status", params.status)
  if (params?.date_from) query.set("date_from", params.date_from)
  if (params?.date_to) query.set("date_to", params.date_to)
  const qs = query.toString()
  return qs ? `${appConfig.apiManagementFeedbackExport}?${qs}` : appConfig.apiManagementFeedbackExport
}

// ── Provider Model CRUD ──

function _providerModelUrl(name: string): string {
  return `${appConfig.apiManagementProviderConfigs}/${encodeURIComponent(name)}/models`
}

function _providerModelItemUrl(name: string, modelId: string): string {
  return `${_providerModelUrl(name)}/${encodeURIComponent(modelId)}`
}

export async function fetchProviderModels(name: string): Promise<ProviderModel[]> {
  return request<ProviderModel[]>(_providerModelUrl(name))
}

export async function createProviderModel(name: string, model: ProviderModel): Promise<ProviderModel> {
  return request<ProviderModel>(_providerModelUrl(name), {
    method: "POST",
    body: JSON.stringify(model),
  })
}

export async function updateProviderModel(name: string, modelId: string, model: ProviderModel): Promise<ProviderModel> {
  return request<ProviderModel>(_providerModelItemUrl(name, modelId), {
    method: "PUT",
    body: JSON.stringify(model),
  })
}

export async function deleteProviderModel(name: string, modelId: string): Promise<void> {
  await request(_providerModelItemUrl(name, modelId), { method: "DELETE" })
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

// ── Metrics ──

export async function fetchMetrics(params?: MetricsQuery): Promise<MetricsSummary> {
  const query = new URLSearchParams()
  if (params?.date_from) query.set("date_from", params.date_from)
  if (params?.date_to) query.set("date_to", params.date_to)
  const qs = query.toString()
  const url = qs ? `${appConfig.apiManagementMetrics}?${qs}` : appConfig.apiManagementMetrics
  return request<MetricsSummary>(url)
}
