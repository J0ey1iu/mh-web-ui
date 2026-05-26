export interface ToolCallDisplay {
  id: string
  name: string
  status: "running" | "success" | "error"
  progress?: string
  result?: string
  meta?: string
}
