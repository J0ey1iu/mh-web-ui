import { defineStore } from "pinia"
import { ref, computed, watch } from "vue"
import router from "../router"
import type { MessageItem, SessionInfo, Message, ToolCallDisplay, ResponseItem, ScenarioInfo, AgentInfo, StreamingState } from "../types"
import { SSE_EVENTS } from "../types"
import { useI18nStore } from "./i18n"
import { fetchMessages, fetchSessions, createSession, deleteSession, fetchScenarios, fetchScenarioDetail, streamChat } from "../api/client"

const FLUSH_INTERVAL = 100

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function formatTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function freshState(): StreamingState {
  return {
    content: "",
    reasoning: "",
    toolCalls: [],
    orderedItems: [],
    isStreaming: false,
  }
}

export const useChatStore = defineStore("chat", () => {
  const sessions = ref<SessionInfo[]>([])
  const currentSessionId = ref<string | null>(null)
  const pendingAgent = ref<string | null>(null)
  const creatingSession = ref(false)
  const messages = ref<Message[]>([])
  const error = ref<string | null>(null)
  const backendOnline = ref<boolean | null>(null)
  const sessionsLoading = ref(false)
  const messagesLoading = ref(false)
  const currentSession = computed(() => sessions.value.find((s) => s.memory_id === currentSessionId.value) ?? null)
  const availableScenarios = ref<ScenarioInfo[]>([])
  const currentScenario = ref<ScenarioInfo | null>(null)
  const availableAgents = ref<AgentInfo[]>([])
  const toolDisplayNames = ref<Record<string, string>>({})

  const streaming = ref<StreamingState>(freshState())

  let errorTimer: ReturnType<typeof setTimeout> | null = null

  const sessionPendingMap: Record<string, StreamingState> = {}
  const sessionStreamingMap = ref<Record<string, StreamingState>>({})
  const sessionMessagesMap: Record<string, Message[]> = {}
  const sessionAbortMap: Record<string, AbortController> = {}
  const sessionFlushTimers: Record<string, ReturnType<typeof setTimeout> | null> = {}

  function saveCurrentSession() {
    const sid = currentSessionId.value
    if (!sid) return
    sessionMessagesMap[sid] = [...messages.value]
    if (sessionStreamingMap.value[sid]) {
      sessionStreamingMap.value[sid] = { ...streaming.value }
    }
  }

  function restoreStreamState(sid: string) {
    if (sessionStreamingMap.value[sid]) {
      streaming.value = { ...sessionStreamingMap.value[sid] }
    } else {
      streaming.value = freshState()
    }
    const p = sessionPendingMap[sid]
    if (p?.isStreaming) scheduleFlush(sid)
  }

  function flush(sid: string) {
    const p = sessionPendingMap[sid]
    if (!p) return
    sessionStreamingMap.value[sid] = {
      content: p.content,
      reasoning: p.reasoning,
      toolCalls: p.toolCalls.map(tc => ({ ...tc })),
      orderedItems: [...p.orderedItems],
      isStreaming: p.isStreaming,
    }
    if (sid === currentSessionId.value) {
      streaming.value = sessionStreamingMap.value[sid]!
    }
  }

  function scheduleFlush(sid: string) {
    if (sessionFlushTimers[sid] !== null && sessionFlushTimers[sid] !== undefined) return
    sessionFlushTimers[sid] = setTimeout(() => {
      sessionFlushTimers[sid] = null
      flush(sid)
      const p = sessionPendingMap[sid]
      if (p?.isStreaming && sid === currentSessionId.value) scheduleFlush(sid)
    }, FLUSH_INTERVAL)
  }

  function cancelFlush(sid: string) {
    if (sessionFlushTimers[sid] !== null && sessionFlushTimers[sid] !== undefined) {
      clearTimeout(sessionFlushTimers[sid]!)
      sessionFlushTimers[sid] = null
    }
  }

  function flushImmediately(sid: string) {
    cancelFlush(sid)
    flush(sid)
  }

  function appendOrUpdateItem(sid: string, type: ResponseItem["type"], text: string) {
    const p = sessionPendingMap[sid]
    if (!p) return
    const items = p.orderedItems
    const last = items[items.length - 1]
    if (last?.type === type) {
      last.text = (last.text || "") + text
    } else {
      items.push({ type, text })
    }
  }

  function buildMessage(sid: string): Message | null {
    const p = sessionPendingMap[sid]
    if (!p) return null
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: p.content,
      orderedItems: p.orderedItems,
      tool_calls:
        p.toolCalls.length > 0 ? p.toolCalls : undefined,
      freshlyStreamed: true,
    }
  }

  function finalizeStream(sid: string) {
    if (!sessionPendingMap[sid]) return
    const msg = buildMessage(sid)
    if (!msg) return
    Object.assign(sessionPendingMap[sid], freshState())
    sessionStreamingMap.value[sid] = freshState()
    if (!sessionMessagesMap[sid]) sessionMessagesMap[sid] = []
    sessionMessagesMap[sid].push(msg)
    if (sid === currentSessionId.value) {
      messages.value = [...sessionMessagesMap[sid]]
      streaming.value = freshState()
    }
  }

  function handleSSEEvent(sid: string, event: string, data: any) {
    const p = sessionPendingMap[sid]
    if (!p) return
    switch (event) {
      case SSE_EVENTS.LLM_CHUNK:
        if (data.reasoning) {
          p.reasoning += data.reasoning
          appendOrUpdateItem(sid, "reasoning", data.reasoning)
        }
        if (data.content) {
          p.content += data.content
          appendOrUpdateItem(sid, "content", data.content)
        }
        break

      case SSE_EVENTS.LLM_END:
        if (data.error) {
          error.value = data.error
        }
        if (data.reasoning_content && !p.reasoning) {
          p.reasoning = data.reasoning_content
          appendOrUpdateItem(sid, "reasoning", data.reasoning_content)
        }
        break

      case SSE_EVENTS.TOOL_START: {
        const tc: ToolCallDisplay = {
          id: data.tool_call?.id ?? `tool-${Date.now()}`,
          name: data.tool_call?.function?.name ?? "unknown",
          displayName: data.display_name ?? data.tool_call?.function?.name ?? "unknown",
          status: "running",
        }
        p.toolCalls.push(tc)
        p.orderedItems.push({
          type: "tool_call",
          toolCallIndex: p.toolCalls.length - 1,
        })
        break
      }

      case SSE_EVENTS.TOOL_PROGRESS: {
        const idx = p.toolCalls.findIndex(
          (t) => t.id === data.tool_call?.id,
        )
        if (idx >= 0 && data.chunk) {
          const chunk =
            typeof data.chunk === "string"
              ? data.chunk
              : JSON.stringify(data.chunk)
          p.toolCalls[idx].progress = (p.toolCalls[idx].progress || "") + chunk
        }
        break
      }

      case SSE_EVENTS.TOOL_END: {
        const idx = p.toolCalls.findIndex(
          (t) => t.id === data.tool_call?.id,
        )
        if (idx >= 0) {
          const resultStr =
            typeof data.result === "string"
              ? data.result
              : JSON.stringify(data.result)
          p.toolCalls[idx].status =
            typeof resultStr === "string" && resultStr.startsWith("[Error]")
              ? "error"
              : "success"
          p.toolCalls[idx].result = resultStr
          if (data.meta) {
            p.toolCalls[idx].meta =
              typeof data.meta === "string"
                ? data.meta
                : JSON.stringify(data.meta)
          }
          flush(sid)
          if (p.isStreaming) scheduleFlush(sid)
        } else {
          console.warn(
            `ToolEnd with no matching ToolStart: id=${data.tool_call?.id}, ` +
            `available IDs: [${p.toolCalls.map((t) => t.id).join(", ")}]`,
          )
          for (let i = 0; i < p.toolCalls.length; i++) {
            if (p.toolCalls[i].status === "running") {
              p.toolCalls[i].status = "error"
              p.toolCalls[i].result = "Tool ended without a matching start event"
            }
          }
        }
        break
      }

      case SSE_EVENTS.ERROR:
        flushImmediately(sid)
        if (p.content || p.reasoning || p.toolCalls.length > 0) {
          finalizeStream(sid)
        } else {
          p.isStreaming = false
          if (sid === currentSessionId.value) {
            streaming.value.isStreaming = false
          }
        }
        error.value = data.message || "An unknown error occurred"
        break

      case SSE_EVENTS.AGENT_END:
        if (data.error) {
          error.value = data.error
        }
        for (let i = 0; i < p.toolCalls.length; i++) {
          if (p.toolCalls[i].status === "running") {
            p.toolCalls[i].status = "error"
            p.toolCalls[i].result = p.toolCalls[i].result || "Agent completed before tool finished"
          }
        }
        flushImmediately(sid)
        finalizeStream(sid)
        break
    }
  }

  function handleSSEDone(sid: string) {
    const p = sessionPendingMap[sid]
    if (p?.isStreaming) {
      flushImmediately(sid)
      finalizeStream(sid)
    }
    loadSessions(currentScenario.value?.id)
  }

  function handleSSEError(sid: string, err: Error) {
    const p = sessionPendingMap[sid]
    if (!p) return
    flushImmediately(sid)
    if (p.content || p.reasoning || p.toolCalls.length > 0) {
      finalizeStream(sid)
    } else {
      p.isStreaming = false
      if (sid === currentSessionId.value) {
        streaming.value.isStreaming = false
      }
    }
    error.value = err.message
  }

  async function loadSessions(scenarioId?: string) {
    sessionsLoading.value = true
    try {
      sessions.value = await fetchSessions(scenarioId)
      backendOnline.value = true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("Forbidden")) {
        const i18n = useI18nStore()
        error.value = i18n.t("permission_denied")
      } else {
        backendOnline.value = false
      }
    } finally {
      sessionsLoading.value = false
    }
  }

  async function newSession(agentName: string = "triage") {
    saveCurrentSession()
    try {
      const session = await createSession(agentName, currentScenario.value?.id)
      currentSessionId.value = session.memory_id
      messages.value = []
      const i18n = useI18nStore()
      sessions.value = [{ ...session, title: i18n.t("new_chat_title", { time: formatTime() }), message_count: 1 }, ...sessions.value.filter((s) => s.memory_id !== session.memory_id)]
      await router.replace({ query: { ...router.currentRoute.value.query, session: session.memory_id, agent: undefined } })
    } catch (e) {
      error.value = String(e)
    }
  }

  async function removeSession(memoryId: string) {
    cancelFlush(memoryId)
    sessionAbortMap[memoryId]?.abort()
    delete sessionAbortMap[memoryId]
    delete sessionPendingMap[memoryId]
    delete sessionStreamingMap.value[memoryId]
    delete sessionMessagesMap[memoryId]
    try {
      await deleteSession(memoryId)
      sessions.value = sessions.value.filter((s) => s.memory_id !== memoryId)
      if (currentSessionId.value === memoryId) {
        currentSessionId.value = null
        messages.value = []
        streaming.value = freshState()
        const query = { ...router.currentRoute.value.query }
        delete query.session
        await router.replace({ query })
      }
    } catch (e) {
      error.value = String(e)
    }
  }

  async function selectSession(memoryId: string) {
    if (memoryId === currentSessionId.value) return
    saveCurrentSession()
    currentSessionId.value = memoryId
    pendingAgent.value = null

    if (sessionMessagesMap[memoryId]) {
      messages.value = [...sessionMessagesMap[memoryId]]
      restoreStreamState(memoryId)
    } else {
      messages.value = []
      messagesLoading.value = true
      try {
        const apiMessages = await fetchMessages(memoryId)
        const transformed = transformMessages(apiMessages)
        sessionMessagesMap[memoryId] = transformed
        messages.value = [...transformed]
      } catch (e) {
        error.value = String(e)
      } finally {
        messagesLoading.value = false
      }
    }
    await router.replace({ query: { ...router.currentRoute.value.query, session: memoryId, agent: undefined } })
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return
    if (!currentSessionId.value && pendingAgent.value) {
      if (creatingSession.value) return
      creatingSession.value = true
      const agentName = pendingAgent.value
      pendingAgent.value = null
      try {
        const session = await createSession(agentName, currentScenario.value?.id)
        currentSessionId.value = session.memory_id
        messages.value = []
        const i18n = useI18nStore()
        sessions.value = [{ ...session, title: i18n.t("new_chat_title", { time: formatTime() }), message_count: 1 }, ...sessions.value.filter((s) => s.memory_id !== session.memory_id)]
        await router.replace({ query: { ...router.currentRoute.value.query, session: session.memory_id, agent: undefined } })
      } catch (e) {
        error.value = String(e)
        await router.replace({ query: { ...router.currentRoute.value.query, agent: undefined } })
        return
      } finally {
        creatingSession.value = false
      }
    }
    if (!currentSessionId.value) return
    const sid = currentSessionId.value
    const userMsg: Message = { id: `msg-${Date.now()}`, role: "user", content: text }
    messages.value.push(userMsg)
    if (!sessionMessagesMap[sid]) sessionMessagesMap[sid] = []
    sessionMessagesMap[sid].push(userMsg)

    const pending = freshState()
    pending.isStreaming = true
    sessionPendingMap[sid] = pending
    sessionStreamingMap.value[sid] = { content: "", reasoning: "", toolCalls: [], orderedItems: [], isStreaming: true }
    streaming.value = sessionStreamingMap.value[sid]!

    scheduleFlush(sid)

    sessionAbortMap[sid] = streamChat(
      sid,
      text,
      (event, data) => handleSSEEvent(sid, event, data),
      () => handleSSEDone(sid),
      (err) => handleSSEError(sid, err),
    )
  }

  async function createSessionWithAgent(agentName: string) {
    pendingAgent.value = agentName
    await router.replace({ query: { ...router.currentRoute.value.query, agent: agentName } })
  }

  async function loadScenarios() {
    try {
      availableScenarios.value = await fetchScenarios()
    } catch { /* */ }
  }

  async function selectScenario(scenarioId: string) {
    saveCurrentSession()
    const found = availableScenarios.value.find((s) => s.id === scenarioId)
    if (!found) return
    currentScenario.value = found
    try {
      const detail = await fetchScenarioDetail(scenarioId)
      availableAgents.value = detail.agents
      const map: Record<string, string> = {}
      for (const a of detail.agents) {
        for (const t of a.tools) map[t.name] = t.display_name || t.name
      }
      toolDisplayNames.value = map
    } catch { /* */ }
    currentSessionId.value = null
    pendingAgent.value = null
    messages.value = []
    await loadSessions(scenarioId)
    await router.replace({ query: { ...router.currentRoute.value.query, scene: scenarioId, session: undefined, agent: undefined } })
  }

  function cancelStream() {
    const sid = currentSessionId.value
    if (!sid) return
    cancelFlush(sid)
    sessionAbortMap[sid]?.abort()
    delete sessionAbortMap[sid]
    const p = sessionPendingMap[sid]
    if (!p) return
    if (p.content || p.reasoning || p.toolCalls.length > 0) {
      flushImmediately(sid)
      const msg = buildMessage(sid)
      if (msg) {
        if (!sessionMessagesMap[sid]) sessionMessagesMap[sid] = []
        sessionMessagesMap[sid].push(msg)
        messages.value = [...sessionMessagesMap[sid]]
      }
      streaming.value = freshState()
    } else {
      p.isStreaming = false
      streaming.value.isStreaming = false
    }
    Object.assign(p, freshState())
    sessionStreamingMap.value[sid] = freshState()
  }

  async function refreshLocaleData() {
    await loadScenarios()
    await loadSessions(currentScenario.value?.id)
    if (currentScenario.value) {
      const updated = availableScenarios.value.find(
        (s) => s.id === currentScenario.value!.id
      )
      if (updated) currentScenario.value = updated
    }
    if (currentScenario.value) {
      try {
        const detail = await fetchScenarioDetail(currentScenario.value.id)
        availableAgents.value = detail.agents
        const map: Record<string, string> = {}
        for (const a of detail.agents) {
          for (const t of a.tools) map[t.name] = t.display_name || t.name
        }
        toolDisplayNames.value = map
      } catch { /* */ }
    }
  }

  function transformMessages(apiMessages: MessageItem[]): Message[] {
    const result: Message[] = []
    let i = 0
    while (i < apiMessages.length) {
      const msg = apiMessages[i]
      if (msg.role === "user") {
        result.push({ id: msg.id, role: "user", content: msg.content })
        i++
        continue
      }
      if (msg.role === "tool") { i++; continue }
      const assistantId = msg.id
      let content = ""
      const orderedItems: ResponseItem[] = []
      const toolCalls: ToolCallDisplay[] = []
      while (i < apiMessages.length) {
        const m = apiMessages[i]
        if (m.role === "user") break
        if (m.role === "reasoning") {
          orderedItems.push({ type: "reasoning", text: m.content })
          i++
        } else if (m.role === "assistant") {
          if (m.content) {
            content += m.content
            orderedItems.push({ type: "content", text: m.content })
          }
          if (m.tool_calls) {
            for (const tc of m.tool_calls) {
              const rawName = tc.function?.name || "unknown"
              const display: ToolCallDisplay = {
                id: tc.id,
                name: rawName,
                displayName: toolDisplayNames.value[rawName] || rawName,
                status: "success",
              }
              toolCalls.push(display)
              orderedItems.push({ type: "tool_call", toolCallIndex: toolCalls.length - 1 })
            }
          }
          i++
        } else if (m.role === "tool") {
          const found = toolCalls.find((t) => t.id === m.tool_call_id)
          if (found) {
            found.result = m.content
            found.progress = m.progress?.join("\n")
            if (m.meta) {
              found.meta = typeof m.meta === "string" ? m.meta : JSON.stringify(m.meta)
            }
            found.status = m.content.startsWith("[Error]") ? "error" : "success"
          }
          i++
        } else { i++ }
      }
      if (content || orderedItems.length > 0) {
        const assistant: Message = { id: assistantId, role: "assistant", content }
        if (orderedItems.length > 0) assistant.orderedItems = orderedItems
        if (toolCalls.length > 0) assistant.tool_calls = toolCalls
        result.push(assistant)
      }
    }
    return result
  }

  function clearError() {
    if (errorTimer) {
      clearTimeout(errorTimer)
      errorTimer = null
    }
    error.value = null
  }

  watch(currentSessionId, (newVal) => {
    if (!newVal) {
      streaming.value = freshState()
    }
  })

  watch(error, (val) => {
    if (errorTimer) {
      clearTimeout(errorTimer)
      errorTimer = null
    }
    if (val) {
      errorTimer = setTimeout(() => {
        error.value = null
        errorTimer = null
      }, 5000)
    }
  })

  return {
    sessions, currentSessionId, currentSession, pendingAgent, messages, streaming, error,
    backendOnline, availableScenarios, currentScenario, availableAgents, toolDisplayNames,
    sessionsLoading, messagesLoading,
    saveCurrentSession,
    loadSessions, newSession, removeSession, selectSession, sendMessage, cancelStream,
    loadScenarios, selectScenario, createSessionWithAgent, refreshLocaleData, clearError,
  }
})
