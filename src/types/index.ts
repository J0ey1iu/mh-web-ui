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
}

export interface EvalInput {
  input_text: string
  agent_name: string
}

export interface EvalJobConfig {
  scenario_id: string
  description?: string
  inputs: EvalInput[]
  max_concurrency: number
  cost_per_million_input_tokens?: number | null
  cost_per_million_output_tokens?: number | null
}

export interface EvalTokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_cost: number | null
  output_cost: number | null
  total_cost: number | null
}

export interface EvalRunRecord {
  run_id: string
  agent_metadata_id: string
  input_text: string
  status: "completed" | "failed" | "interrupted"
  time_taken: number | null
  error: string | null
  response: string | null
  token_usage: EvalTokenUsage | null
  llm_call_count: number
  tool_call_count: number
  exceeded: boolean
}

export interface EvalSummary {
  task_name: string
  description: string
  agent_metadata_id: string
  total_runs: number
  completed: number
  failed: number
  interrupted: number
  total_time: number
  avg_time: number
  total_tokens: number
  total_cost: number | null
  runs: EvalRunRecord[]
}

export interface EvalJob {
  job_id: string
  scenario_id: string
  status: "pending" | "running" | "completed" | "failed"
  created_at: number | null
  finished_at: number | null
  error: string | null
  report_url?: string
  summary?: EvalSummary
}

export interface GeneratedTool {
  name: string
  display_name: string
  description: string
  parameters: Record<string, any>
  source_code: string
  user_id?: string
  created_at?: string
  updated_at?: string
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
}

export interface ManageAgent {
  name: string
  display_name: string
  display_name_locale?: string
  description: string
  description_locale?: string
  system_prompt: string
  system_prompt_locale?: string
  endpoint_url?: string
  created_at?: string
  updated_at?: string
}

export interface ManageTool {
  name: string
  display_name: string
  display_name_locale?: string
  description: string
  description_locale?: string
  parameters: Record<string, any>
  endpoint_url?: string
  created_at?: string
  updated_at?: string
}
