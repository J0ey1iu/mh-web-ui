import type { AgentInfo, EvalJob, EvalJobConfig, MessageItem, ScenarioDetail, ScenarioInfo, SessionInfo, UserInfo, SSEEventName } from "../types"
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

export type SSEEventCallback = (event: SSEEventName, data: any) => void

export function streamChat(memoryId: string, message: string, onEvent: SSEEventCallback, onDone: () => void, onError: (err: Error) => void): AbortController {
  const controller = new AbortController()
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept-Language": getLocale() }

  fetch(fillUrl(appConfig.apiChat, { id: memoryId }), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ message }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")
      const decoder = new TextDecoder()
      let buffer = ""
      let eventName = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim()
          else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim()
            try { const data = JSON.parse(dataStr); onEvent(eventName as SSEEventName, data) } catch {}
          }
        }
      }
      onDone()
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err instanceof Error ? err : new Error(String(err)))
    })

  return controller
}

export async function fetchEvalJobs(): Promise<EvalJob[]> {
  return request<EvalJob[]>(appConfig.apiEvalJobs)
}

export async function createEvalJob(config: EvalJobConfig): Promise<{ job_id: string; status: string }> {
  return request(appConfig.apiEvalJobs, {
    method: "POST",
    body: JSON.stringify(config),
  })
}

export async function fetchEvalJob(jobId: string): Promise<EvalJob> {
  return request<EvalJob>(fillUrl(appConfig.apiEvalJob, { id: jobId }))
}

export function getEvalReportUrl(jobId: string): string {
  return fillUrl(appConfig.apiEvalResults, { id: jobId, filename: "report.html" })
}
