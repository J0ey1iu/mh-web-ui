export interface SessionInfo {
  memory_id: string
  title: string
  created_at: string
  message_count: number
  agent_name: string
  scenario_id?: string
}

export interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

export type MessageRole = "user" | "assistant" | "tool"

export interface ResponseItem {
  type: "reasoning" | "content" | "tool_call"
  text?: string
  toolCallIndex?: number
}

export interface Message {
  id: string
  role: MessageRole
  content: string | null
  orderedItems?: ResponseItem[]
  tool_calls?: ToolCallDisplay[]
  freshlyStreamed?: boolean
}

export interface ToolCallDisplay {
  id: string
  name: string
  displayName?: string
  status: "running" | "success" | "error"
  progress?: string
  result?: string
  meta?: string
}

export interface ToolInfo {
  name: string
  display_name: string
}

export interface ToolCallComponentProps {
  tool: ToolCallDisplay
}

export const SSE_EVENTS = {
  LLM_CHUNK: "LLMChunk",
  LLM_END: "LLMEnd",
  TOOL_START: "ToolStart",
  TOOL_PROGRESS: "ToolProgress",
  TOOL_END: "ToolEnd",
  AGENT_END: "AgentEnd",
  ERROR: "Error",
} as const

export type SSEEventName = typeof SSE_EVENTS[keyof typeof SSE_EVENTS]

export interface MessageItem {
  id: string
  role: string
  content: string
  tool_calls: Array<{
    id: string
    function: { name: string; arguments: string }
  }> | null
  tool_call_id: string | null
  progress?: string[]
  meta?: string
}

export interface StreamingState {
  content: string
  reasoning: string
  toolCalls: ToolCallDisplay[]
  orderedItems: ResponseItem[]
  isStreaming: boolean
}

export interface RoleInfo {
  id: number
  name: string
}

export interface UserInfo {
  id: string
  username: string
  roles: RoleInfo[]
}

export interface ScenarioInfo {
  id: string
  name: string
  icon: string
  description: string
  agents: string[]
}

export interface ScenarioDetail {
  id: string
  name: string
  icon: string
  description: string
  agents: AgentInfo[]
}

export interface AgentInfo {
  name: string
  display_name: string
  description: string
  tool_names: string[]
  tools: ToolInfo[]
}
