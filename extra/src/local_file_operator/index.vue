<script lang="ts">
export const demoMock = {
  status: "success" as const,
  progress: JSON.stringify({ message: "Reading file: /home/user/example.txt" }),
  result: JSON.stringify({
    status: "ok",
    message: "Read 156 characters from /home/user/example.txt",
    content: "Hello World\nThis is a sample file.\nLine 3: more content here.\n",
    path: "/home/user/example.txt",
    size: 156,
  }),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: JSON.stringify({ message: "Searching directory: /home/user/projects" }),
  result: "",
}

export const demoMockError = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "error",
    message: "File not found: /tmp/nonexistent.txt",
    suggestion: "Check if the path exists using exists operation, or create it",
  }),
}

const _sampleDiff = [
  "--- a/home/user/example.py",
  "+++ b/home/user/example.py",
  "@@ -1,9 +1,10 @@",
  " def greet(name):",
  '-    print("Hello, " + name)',
  '+    print(f"Hello, {name}")',
  " ",
  " def add(a, b):",
  "     return a + b",
  " ",
  "+def multiply(a, b):",
  "+    return a * b",
  "+",
  " if __name__ == '__main__':",
  '-    greet("World")',
  '+    user = input("Enter your name: ")',
  '+    greet(user)',
]

const _sampleEntries = [
  { name: "src", type: "directory", size: 0 },
  { name: "docs", type: "directory", size: 0 },
  { name: "README.md", type: "file", size: 2842 },
  { name: "package.json", type: "file", size: 512 },
  { name: "main.py", type: "file", size: 1560 },
  { name: "tests", type: "directory", size: 0 },
]

export const demoMockListDir = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "ok",
    message: "Listed 6 entries in /home/user/project",
    entries: _sampleEntries,
    path: "/home/user/project",
    total: 6,
  }),
}

export const demoMockExists = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "ok",
    message: "Path exists: /home/user/project",
    path: "/home/user/project",
    exists: true,
    is_file: false,
    is_dir: true,
  }),
}

export const demoMockEdit = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "ok",
    message: "Replaced 2 occurrence(s) in /home/user/example.py",
    path: "/home/user/example.py",
    replacement_count: 2,
    diff: _sampleDiff,
  }),
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface DirEntry {
  name: string
  type: "file" | "directory"
  size: number
}

interface FileOpResult {
  status: string
  message?: string
  path?: string
  size?: number
  content?: string
  operation?: string
  entries?: DirEntry[]
  total?: number
  source?: string
  destination?: string
  exists?: boolean
  is_file?: boolean
  is_dir?: boolean
  replacement_count?: number
  file_content_preview?: string
  suggestion?: string
  diff?: string[]
}

const parsedResult = computed<FileOpResult | null>(() => {
  if (!props.tool.result) return null
  try {
    return JSON.parse(props.tool.result) as FileOpResult
  } catch {
    return null
  }
})

function extractLastJson(raw: string): Record<string, unknown> | null {
  const close = raw.lastIndexOf("}")
  if (close < 0) return null
  const open = raw.lastIndexOf("{", close)
  if (open < 0) return null
  try {
    return JSON.parse(raw.substring(open, close + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

const progressMessage = computed(() => {
  if (!props.tool.progress) return null
  const obj = extractLastJson(props.tool.progress)
  if (obj?.message && typeof obj.message === "string") return obj.message
  return props.tool.progress
})

const isError = computed(() => {
  if (props.tool.status === "error") return true
  if (parsedResult.value?.status === "error") return true
  return false
})

const showContent = computed(() => {
  const r = parsedResult.value
  return r && r.content !== undefined && r.content !== null
})

const showEntries = computed(() => {
  const r = parsedResult.value
  return r && r.entries && r.entries.length > 0
})

const showExists = computed(() => {
  const r = parsedResult.value
  return r && r.exists !== undefined
})

const showMoveCopy = computed(() => {
  const r = parsedResult.value
  return r && r.source && r.destination
})

const showDiff = computed(() => {
  const r = parsedResult.value
  return r && r.diff && r.diff.length > 0
})

const diffLineClass = (line: string): string => {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) return "lfo-diff-meta"
  if (line.startsWith("+")) return "lfo-diff-add"
  if (line.startsWith("-")) return "lfo-diff-del"
  return "lfo-diff-ctx"
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="lfo" :class="{ running: tool.status === 'running', success: tool.status === 'success' && !isError, error: tool.status === 'error' || isError }">
    <template v-if="tool.status === 'running'">
      <div class="lfo-loading">
        <span class="lfo-spinner" />
        <span class="lfo-status-label">{{ progressMessage || t("executing") }}</span>
      </div>
    </template>

    <template v-else-if="parsedResult">
      <div class="lfo-card">
        <div class="lfo-header">
          <span class="lfo-message" :class="{ error: isError }">{{ parsedResult.message }}</span>
        </div>

        <div v-if="showContent" class="lfo-section">
          <pre class="lfo-content"><code>{{ parsedResult.content }}</code></pre>
        </div>

        <div v-else-if="parsedResult.file_content_preview" class="lfo-section">
          <pre class="lfo-content"><code>{{ parsedResult.file_content_preview }}</code></pre>
        </div>

        <div v-if="parsedResult.path" class="lfo-info-row">
          <span class="lfo-path-value">{{ parsedResult.path }}</span>
          <span v-if="parsedResult.size !== undefined" class="lfo-size-value">({{ formatSize(parsedResult.size) }})</span>
          <span v-if="parsedResult.replacement_count !== undefined" class="lfo-size-value">({{ parsedResult.replacement_count }} {{ t("replacements") }})</span>
        </div>

        <div v-if="showDiff" class="lfo-section">
          <div class="lfo-diff">
            <div
              v-for="(line, idx) in parsedResult.diff"
              :key="idx"
              class="lfo-diff-line"
              :class="diffLineClass(line)"
            ><span class="lfo-diff-code">{{ line }}</span></div>
          </div>
        </div>

        <div v-if="showEntries" class="lfo-section">
          <div class="lfo-file-list">
            <div
              v-for="entry in parsedResult.entries"
              :key="entry.name"
              class="lfo-file-row"
              :class="{ isDir: entry.type === 'directory' }"
            >
              <span class="lfo-file-name">{{ entry.name }}</span>
              <span v-if="entry.type === 'file'" class="lfo-file-size">{{ formatSize(entry.size) }}</span>
              <span v-else class="lfo-file-size lfo-dir-label">{{ t("directory") }}</span>
            </div>
          </div>
        </div>

        <div v-if="showExists" class="lfo-exists-row">
          <span v-if="parsedResult.exists" class="lfo-exists-badge lfo-exists-yes">{{ t("exists") }}</span>
          <span v-else class="lfo-exists-badge lfo-exists-no">{{ t("not_exists") }}</span>
          <span v-if="parsedResult.is_dir" class="lfo-type-badge">{{ t("directory") }}</span>
          <span v-if="parsedResult.is_file" class="lfo-type-badge">{{ t("file") }}</span>
        </div>

        <div v-if="showMoveCopy" class="lfo-move-row">
          <span class="lfo-move-path">{{ parsedResult.source }}</span>
          <span class="lfo-move-arrow">&rarr;</span>
          <span class="lfo-move-path">{{ parsedResult.destination }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="tool.status === 'error'">
      <div class="lfo-card lfo-card-error">
        <div class="lfo-error-msg">{{ tool.result }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lfo { margin: 2px 0; font-family: var(--font-sans, "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif); }
.lfo-loading { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
.lfo-spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: lfoSpin 0.8s linear infinite; flex-shrink: 0; }
.lfo-status-label { font-size: 13px; color: var(--text-secondary); }
.lfo-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; background: var(--glass-bg, transparent); }
.lfo.success .lfo-card { border-color: var(--success); }
.lfo.error .lfo-card,
.lfo-card-error { border-color: var(--error); }
.lfo-header { margin-bottom: 6px; }
.lfo-message { font-size: 13px; color: var(--text-primary); line-height: 1.4; word-break: break-word; }
.lfo-message.error { color: var(--error); }
.lfo-section { margin-bottom: 6px; }
.lfo-content { margin: 4px 0 0; padding: 6px 10px; border-radius: 6px; background: color-mix(in srgb, var(--surface-bg, #1a1a20) 40%, transparent); border: 1px solid var(--border); font-family: var(--font-mono, ui-monospace, "SF Mono", "Cascadia Code", "Consolas", monospace); font-size: 12px; line-height: 1.5; overflow-x: auto; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; color: var(--text-primary); }
.lfo-info-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.lfo-path-value { font-family: var(--font-mono, ui-monospace, "SF Mono", "Cascadia Code", "Consolas", monospace); font-size: 12px; word-break: break-all; }
.lfo-size-value { color: var(--text-tertiary); flex-shrink: 0; }
.lfo-file-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.lfo-file-row { display: flex; align-items: center; gap: 8px; padding: 5px 10px; font-size: 12px; border-bottom: 1px solid var(--border); }
.lfo-file-row:last-child { border-bottom: none; }
.lfo-file-name { flex: 1; color: var(--text-primary); font-family: var(--font-mono, ui-monospace, "SF Mono", "Cascadia Code", "Consolas", monospace); font-size: 12px; word-break: break-all; }
.lfo-file-row.isDir .lfo-file-name { font-weight: 500; }
.lfo-file-size { font-size: 11px; color: var(--text-tertiary); flex-shrink: 0; }
.lfo-dir-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
.lfo-exists-row { display: flex; align-items: center; gap: 8px; }
.lfo-exists-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
.lfo-exists-yes { background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success); }
.lfo-exists-no { background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); }
.lfo-type-badge { font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 4px; background: var(--border); color: var(--text-tertiary); }
.lfo-move-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.lfo-move-path { font-family: var(--font-mono, ui-monospace, "SF Mono", "Cascadia Code", "Consolas", monospace); font-size: 12px; color: var(--text-primary); word-break: break-all; }
.lfo-move-arrow { font-size: 14px; color: var(--text-muted); flex-shrink: 0; }
.lfo-diff { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-family: var(--font-mono, ui-monospace, "SF Mono", "Cascadia Code", "Consolas", monospace); font-size: 12px; line-height: 1.5; background: color-mix(in srgb, #000 4%, var(--surface-bg, #1a1a20) 96%); }
.lfo-diff-line { padding: 0 10px; white-space: pre-wrap; word-break: break-all; min-height: 1.5em; display: flex; align-items: center; }
.lfo-diff-code { white-space: pre-wrap; word-break: break-all; width: 100%; }
.lfo-diff-meta { background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--accent); font-weight: 500; }
.lfo-diff-add { background: color-mix(in srgb, #22c55e 8%, transparent); border-left: 3px solid #22c55e; padding-left: 7px; }
.lfo-diff-add .lfo-diff-code { color: #22c55e; }
.lfo-diff-del { background: color-mix(in srgb, #ef4444 8%, transparent); border-left: 3px solid #ef4444; padding-left: 7px; }
.lfo-diff-del .lfo-diff-code { color: #ef4444; }
.lfo-diff-ctx { color: var(--text-secondary); }
.lfo-error-msg { font-size: 13px; color: var(--error); padding: 4px 0; }
@keyframes lfoSpin { to { transform: rotate(360deg); } }
</style>
