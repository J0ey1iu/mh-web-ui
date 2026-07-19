export interface SessionInfo {
  memory_id: string
  title: string
  created_at: string
  message_count: number
  agent_name: string
  scenario_id?: string
  display_name?: string
  compact_offset?: number
}

export interface MessagesResponse {
  items: MessageItem[]
  compact_offset: number
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

export interface CompactStats {
  duration: number
  droppedMessageCount: number
  totalTokens?: number
}

export interface Message {
  id: string
  role: MessageRole
  content: string | null
  orderedItems?: ResponseItem[]
  tool_calls?: ToolCallDisplay[]
  freshlyStreamed?: boolean
  compactBoundary?: boolean
  compactStats?: CompactStats
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
  COMPACTION_START: "CompactionStart",
  COMPACTION_CHUNK: "CompactionChunk",
  COMPACTION_END: "CompactionEnd",
} as const

export type SSEEventName = typeof SSE_EVENTS[keyof typeof SSE_EVENTS]

export interface CompactionStart {
  dropped_message_count: number
  existing_summary: string | null
  keep_recent: number
  total_tokens: number
}

export interface CompactionChunk {
  type?: "reasoning" | "content"
  delta: string
  accumulated: string
}

export interface CompactionEnd {
  summary: string
  dropped_message_count: number
  new_offset: number
  duration: number
  error: string | null
}

export interface SlashCommand {
  name: string
  displayName: string
  description: string
  handler: (ctx: { sessionId: string }) => void | Promise<void>
}

export interface MessageItem {
  id: string
  role: string
  content: string
  reasoning?: string
  tool_calls: Array<{
    id: string
    function: { name: string; arguments: string }
  }> | null
  tool_call_id: string | null
  progress?: string[]
  meta?: string
  compact_boundary?: boolean
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
  permissions?: string[]
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
  provider?: string
  model?: string
}

export interface ManageScenario {
  id: string
  name: string
  name_locale?: string
  icon: string
  description: string
  description_locale?: string
  agents?: Array<{ name: string; tool_names: string[] }>
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export interface ManageProvider {
  name: string
  provider_type: string
  api_key?: string
  base_url?: string
  default_model?: string
  description?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export interface ManageAgent {
  name: string
  display_name: string
  display_name_locale?: string
  description: string
  description_locale?: string
  system_prompt: string
  system_prompt_locale?: string
  provider?: string
  provider_name?: string
  model?: string
  llm_config?: Record<string, any>
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export interface ManageTool {
  name: string
  display_name: string
  display_name_locale?: string
  description: string
  description_locale?: string
  parameters: Record<string, any>
  source_code?: string
  endpoint_url?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface FetchListParams {
  q?: string
  page?: number
  page_size?: number
}
