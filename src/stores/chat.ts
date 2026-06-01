import { defineStore } from "pinia"
import { ref, computed } from "vue"
import router from "../router"
import type { MessageItem, SessionInfo, Message, ToolCallDisplay, ResponseItem, ScenarioInfo, AgentInfo, StreamingState } from "../types"
import { SSE_EVENTS } from "../types"
import { useI18nStore } from "./i18n"
import { fetchMessages, fetchSessions, createSession, deleteSession, fetchScenarios, fetchScenarioDetail, streamChat } from "../api/client"

const FLUSH_INTERVAL = 100

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
  const pending: StreamingState = freshState()

  let abortController: AbortController | null = null
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    streaming.value = {
      content: pending.content,
      reasoning: pending.reasoning,
      toolCalls: pending.toolCalls.map(tc => ({ ...tc })),
      orderedItems: [...pending.orderedItems],
      isStreaming: pending.isStreaming,
    }
  }

  function scheduleFlush() {
    if (flushTimer !== null) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
      if (pending.isStreaming) scheduleFlush()
    }, FLUSH_INTERVAL)
  }

  function cancelFlush() {
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }

  function flushImmediately() {
    cancelFlush()
    flush()
  }

  function appendOrUpdateItem(type: ResponseItem["type"], text: string) {
    const items = pending.orderedItems
    const last = items[items.length - 1]
    if (last?.type === type) {
      last.text = (last.text || "") + text
    } else {
      items.push({ type, text })
    }
  }

  function buildMessage(): Message {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: pending.content,
      orderedItems: pending.orderedItems,
      tool_calls:
        pending.toolCalls.length > 0 ? pending.toolCalls : undefined,
      freshlyStreamed: true,
    }
  }

  function finalizeStream() {
    const msg = buildMessage()
    Object.assign(pending, freshState())
    streaming.value = freshState()
    messages.value.push(msg)
  }

  function handleSSEEvent(event: string, data: any) {
    switch (event) {
      case SSE_EVENTS.LLM_CHUNK:
        if (data.reasoning) {
          pending.reasoning += data.reasoning
          appendOrUpdateItem("reasoning", data.reasoning)
        }
        if (data.content) {
          pending.content += data.content
          appendOrUpdateItem("content", data.content)
        }
        break

      case SSE_EVENTS.LLM_END:
        if (data.error) {
          console.warn("LLM ended with error:", data.error)
        }
        if (data.reasoning_content && !pending.reasoning) {
          pending.reasoning = data.reasoning_content
          appendOrUpdateItem("reasoning", data.reasoning_content)
        }
        break

      case SSE_EVENTS.TOOL_START: {
        const tc: ToolCallDisplay = {
          id: data.tool_call?.id ?? `tool-${Date.now()}`,
          name: data.tool_call?.function?.name ?? "unknown",
          displayName: data.display_name ?? data.tool_call?.function?.name ?? "unknown",
          status: "running",
        }
        pending.toolCalls.push(tc)
        pending.orderedItems.push({
          type: "tool_call",
          toolCallIndex: pending.toolCalls.length - 1,
        })
        break
      }

      case SSE_EVENTS.TOOL_PROGRESS: {
        const idx = pending.toolCalls.findIndex(
          (t) => t.id === data.tool_call?.id,
        )
        if (idx >= 0 && data.chunk) {
          const chunk =
            typeof data.chunk === "string"
              ? data.chunk
              : JSON.stringify(data.chunk)
          pending.toolCalls[idx].progress = (pending.toolCalls[idx].progress || "") + chunk
        }
        break
      }

      case SSE_EVENTS.TOOL_END: {
        const idx = pending.toolCalls.findIndex(
          (t) => t.id === data.tool_call?.id,
        )
        if (idx >= 0) {
          const resultStr =
            typeof data.result === "string"
              ? data.result
              : JSON.stringify(data.result)
          pending.toolCalls[idx].status =
            typeof resultStr === "string" && resultStr.startsWith("[Error]")
              ? "error"
              : "success"
          pending.toolCalls[idx].result = resultStr
          if (data.meta) {
            pending.toolCalls[idx].meta =
              typeof data.meta === "string"
                ? data.meta
                : JSON.stringify(data.meta)
          }
          flush()
          if (pending.isStreaming) scheduleFlush()
        } else {
          console.warn(
            `ToolEnd with no matching ToolStart: id=${data.tool_call?.id}, ` +
            `available IDs: [${pending.toolCalls.map((t) => t.id).join(", ")}]`,
          )
          for (let i = 0; i < pending.toolCalls.length; i++) {
            if (pending.toolCalls[i].status === "running") {
              pending.toolCalls[i].status = "error"
              pending.toolCalls[i].result = "Tool ended without a matching start event"
            }
          }
        }
        break
      }

      case SSE_EVENTS.ERROR:
        flushImmediately()
        error.value = data.message || "An unknown error occurred"
        pending.isStreaming = false
        streaming.value.isStreaming = false
        break

      case SSE_EVENTS.AGENT_END:
        if (data.error) {
          console.error("Agent ended with error:", data.error)
        }
        for (let i = 0; i < pending.toolCalls.length; i++) {
          if (pending.toolCalls[i].status === "running") {
            pending.toolCalls[i].status = "error"
            pending.toolCalls[i].result = pending.toolCalls[i].result || "Agent completed before tool finished"
          }
        }
        flushImmediately()
        finalizeStream()
        break
    }
  }

  function handleSSEDone() {
    if (pending.isStreaming) {
      flushImmediately()
      finalizeStream()
    }
    loadSessions(currentScenario.value?.id)
  }

  function handleSSEError(err: Error) {
    flushImmediately()
    error.value = err.message
    pending.isStreaming = false
    streaming.value.isStreaming = false
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
    try {
      const session = await createSession(agentName, currentScenario.value?.id)
      currentSessionId.value = session.memory_id
      messages.value = []
      await router.replace({ query: { ...router.currentRoute.value.query, session: session.memory_id } })
    } catch (e) {
      error.value = String(e)
    }
  }

  async function removeSession(memoryId: string) {
    try {
      await deleteSession(memoryId)
      sessions.value = sessions.value.filter((s) => s.memory_id !== memoryId)
      if (currentSessionId.value === memoryId) {
        currentSessionId.value = null
        messages.value = []
        const query = { ...router.currentRoute.value.query }
        delete query.session
        await router.replace({ query })
      }
    } catch (e) {
      error.value = String(e)
    }
  }

  async function selectSession(memoryId: string) {
    currentSessionId.value = memoryId
    pendingAgent.value = null
    messages.value = []
    messagesLoading.value = true
    try {
      const apiMessages = await fetchMessages(memoryId)
      messages.value = transformMessages(apiMessages)
    } catch (e) {
      error.value = String(e)
    } finally {
      messagesLoading.value = false
    }
    await router.replace({ query: { ...router.currentRoute.value.query, session: memoryId } })
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
        await router.replace({ query: { ...router.currentRoute.value.query, session: session.memory_id } })
      } catch (e) {
        error.value = String(e)
        return
      } finally {
        creatingSession.value = false
      }
    }
    if (!currentSessionId.value) return
    const userMsg: Message = { id: `msg-${Date.now()}`, role: "user", content: text }
    messages.value.push(userMsg)
    Object.assign(pending, freshState(), { isStreaming: true })
    flush()
    scheduleFlush()

    abortController = streamChat(
      currentSessionId.value,
      text,
      handleSSEEvent,
      handleSSEDone,
      handleSSEError,
    )
  }

  async function createSessionWithAgent(agentName: string) {
    pendingAgent.value = agentName
  }

  async function loadScenarios() {
    try {
      availableScenarios.value = await fetchScenarios()
    } catch { /* */ }
  }

  async function selectScenario(scenarioId: string) {
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
    await router.replace({ query: { ...router.currentRoute.value.query, scene: scenarioId, session: undefined } })
  }

  function cancelStream() {
    cancelFlush()
    abortController?.abort()
    abortController = null
    pending.isStreaming = false
    streaming.value.isStreaming = false
  }

  async function refreshLocaleData() {
    await loadScenarios()
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
    error.value = null
  }

  return {
    sessions, currentSessionId, currentSession, pendingAgent, messages, streaming, error,
    backendOnline, availableScenarios, currentScenario, availableAgents, toolDisplayNames,
    sessionsLoading, messagesLoading,
    loadSessions, newSession, removeSession, selectSession, sendMessage, cancelStream,
    loadScenarios, selectScenario, createSessionWithAgent, refreshLocaleData, clearError,
  }
})
