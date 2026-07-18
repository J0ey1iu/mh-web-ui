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

const opIcon = computed(() => {
  const r = parsedResult.value
  if (!r || !r.message) return ""
  const m = r.message.toLowerCase()
  if (m.includes("read")) return "?"
  if (m.includes("wrote") || m.includes("written")) return "?"
  if (m.includes("append")) return "?"
  if (m.includes("replace")) return "?"
  if (m.includes("delet")) return "?"
  if (m.includes("listed") || m.includes("entries")) return "?"
  if (m.includes("creat")) return "?"
  if (m.includes("move")) return "?"
  if (m.includes("copi")) return "?"
  if (m.includes("exist")) return "?"
  return "?"
})
</script>

<template>
  <div class="lfo" :class="{ running: tool.status === 'running', success: tool.status === 'success' && !isError, error: tool.status === 'error' || isError }">
    <!-- Running state -->
    <template v-if="tool.status === 'running'">
      <div class="lfo-loading">
        <span class="lfo-spinner" />
        <div class="lfo-progress-text">
          <div class="lfo-status-label">{{ t("executing") }}</div>
          <div v-if="progressMessage" class="lfo-progress-msg">{{ progressMessage }}</div>
        </div>
      </div>
    </template>

    <!-- Result state -->
    <template v-else-if="parsedResult">
      <div class="lfo-card">
        <!-- Header with icon and message -->
        <div class="lfo-header">
          <span class="lfo-op-icon">{{ opIcon }}</span>
          <span class="lfo-message" :class="{ error: isError }">{{ parsedResult.message }}</span>
        </div>

        <!-- content preview (for read) -->
        <div v-if="showContent" class="lfo-section">
          <div class="lfo-section-label">{{ t("content_preview") }}</div>
          <pre class="lfo-content"><code>{{ parsedResult.content }}</code></pre>
        </div>

        <!-- file_content_preview (for edit old_string not found) -->
        <div v-else-if="parsedResult.file_content_preview" class="lfo-section">
          <div class="lfo-section-label">{{ t("content_preview") }}</div>
          <pre class="lfo-content"><code>{{ parsedResult.file_content_preview }}</code></pre>
        </div>

        <!-- path + size info row -->
        <div v-if="parsedResult.path" class="lfo-info-row">
          <span class="lfo-info-label">{{ t("path") }}</span>
          <span class="lfo-info-value lfo-path-value">{{ parsedResult.path }}</span>
        </div>
        <div v-if="parsedResult.size !== undefined" class="lfo-info-row">
          <span class="lfo-info-label">{{ t("size") }}</span>
          <span class="lfo-info-value">{{ formatSize(parsedResult.size) }} ({{ parsedResult.size }} {{ t("characters") }})</span>
        </div>
        <div v-if="parsedResult.replacement_count !== undefined" class="lfo-info-row">
          <span class="lfo-info-label">{{ t("replacements") }}</span>
          <span class="lfo-info-value">{{ parsedResult.replacement_count }}</span>
        </div>

        <!-- diff display (for edit) -->
        <div v-if="showDiff" class="lfo-section">
          <div class="lfo-section-label">diff</div>
          <div class="lfo-diff">
            <div
              v-for="(line, idx) in parsedResult.diff"
              :key="idx"
              class="lfo-diff-line"
              :class="diffLineClass(line)"
            ><span class="lfo-diff-code">{{ line }}</span></div>
          </div>
        </div>

        <!-- directory listing -->
        <div v-if="showEntries" class="lfo-section">
          <div class="lfo-section-label">{{ t("entries") }} ({{ parsedResult.total }})</div>
          <div class="lfo-file-list">
            <div
              v-for="entry in parsedResult.entries"
              :key="entry.name"
              class="lfo-file-row"
              :class="{ isDir: entry.type === 'directory' }"
            >
              <span class="lfo-file-icon">{{ entry.type === "directory" ? "?" : "?" }}</span>
              <span class="lfo-file-name">{{ entry.name }}</span>
              <span v-if="entry.type === 'file'" class="lfo-file-size">{{ formatSize(entry.size) }}</span>
              <span v-else class="lfo-file-size lfo-dir-label">{{ t("directory") }}</span>
            </div>
          </div>
        </div>

        <!-- exists status -->
        <div v-if="showExists" class="lfo-section">
          <div class="lfo-exists-row">
            <span v-if="parsedResult.exists" class="lfo-exists-badge lfo-exists-yes">{{ t("exists") }}</span>
            <span v-else class="lfo-exists-badge lfo-exists-no">{{ t("not_exists") }}</span>
            <span v-if="parsedResult.is_dir" class="lfo-type-badge">{{ t("directory") }}</span>
            <span v-if="parsedResult.is_file" class="lfo-type-badge">{{ t("file") }}</span>
          </div>
        </div>

        <!-- move/copy source -> destination -->
        <div v-if="showMoveCopy" class="lfo-section">
          <div class="lfo-move-row">
            <div class="lfo-move-item">
              <span class="lfo-move-label">source</span>
              <span class="lfo-move-path">{{ parsedResult.source }}</span>
            </div>
            <span class="lfo-move-arrow">?</span>
            <div class="lfo-move-item">
              <span class="lfo-move-label">destination</span>
              <span class="lfo-move-path">{{ parsedResult.destination }}</span>
            </div>
          </div>
        </div>

        <!-- Suggestion -->
        <div v-if="parsedResult.suggestion" class="lfo-suggestion">
          <span class="lfo-suggestion-icon">?</span>
          <span><strong>{{ t("suggestion") }}:</strong> {{ parsedResult.suggestion }}</span>
        </div>
      </div>
    </template>

    <!-- Error without parsed result -->
    <template v-else-if="tool.status === 'error'">
      <div class="lfo-card lfo-card-error">
        <div class="lfo-error-msg">{{ tool.result }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lfo { margin: 2px 0; }
.lfo-loading { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
.lfo-spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: lfoSpin 0.8s linear infinite; flex-shrink: 0; }
.lfo-progress-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lfo-status-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.lfo-progress-msg { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lfo-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: color-mix(in srgb, var(--surface-bg) 60%, transparent); }
.lfo.success .lfo-card { border-color: color-mix(in srgb, var(--success) 30%, transparent); }
.lfo.error .lfo-card,
.lfo-card-error { border-color: color-mix(in srgb, var(--error) 30%, transparent); }
.lfo-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.lfo-op-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 10%, transparent); flex-shrink: 0; font-size: 14px; }
.lfo-message { font-size: 13px; color: var(--text-primary); line-height: 1.4; word-break: break-word; }
.lfo-message.error { color: var(--error); }
.lfo-section { margin-bottom: 10px; }
.lfo-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
.lfo-content { margin: 0; padding: 8px 10px; border-radius: 6px; background: color-mix(in srgb, var(--surface-bg) 40%, transparent); border: 1px solid var(--border); font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; color: var(--text-primary); }
.lfo-info-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px; }
.lfo-info-label { color: var(--text-muted); font-weight: 500; min-width: 60px; flex-shrink: 0; }
.lfo-info-value { color: var(--text-secondary); word-break: break-all; }
.lfo-path-value { font-family: "SF Mono", "Fira Code", monospace; font-size: 11px; }
.lfo-file-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.lfo-file-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 12px; border-bottom: 1px solid var(--border); }
.lfo-file-row:last-child { border-bottom: none; }
.lfo-file-row:hover { background: color-mix(in srgb, var(--accent) 4%, transparent); }
.lfo-file-icon { flex-shrink: 0; font-size: 13px; }
.lfo-file-name { flex: 1; color: var(--text-primary); font-family: "SF Mono", "Fira Code", monospace; font-size: 12px; word-break: break-all; }
.lfo-file-row.isDir .lfo-file-name { font-weight: 500; }
.lfo-file-size { font-size: 11px; color: var(--text-tertiary); flex-shrink: 0; }
.lfo-dir-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
.lfo-exists-row { display: flex; align-items: center; gap: 8px; }
.lfo-exists-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 6px; }
.lfo-exists-yes { background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success); }
.lfo-exists-no { background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); }
.lfo-type-badge { font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: var(--border); color: var(--text-tertiary); }
.lfo-move-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lfo-move-item { flex: 1; min-width: 120px; }
.lfo-move-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); display: block; margin-bottom: 2px; }
.lfo-move-path { font-family: "SF Mono", "Fira Code", monospace; font-size: 11px; color: var(--text-primary); word-break: break-all; }
.lfo-move-arrow { font-size: 16px; color: var(--text-muted); flex-shrink: 0; }
.lfo-diff { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-family: "SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace; font-size: 12px; line-height: 1.5; background: color-mix(in srgb, #000 4%, var(--surface-bg) 96%); }
.lfo-diff-line { padding: 0 10px; white-space: pre-wrap; word-break: break-all; min-height: 1.5em; display: flex; align-items: center; }
.lfo-diff-code { white-space: pre-wrap; word-break: break-all; width: 100%; }
.lfo-diff-meta { background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--accent); font-weight: 500; letter-spacing: -0.2px; }
.lfo-diff-add { background: color-mix(in srgb, #22c55e 8%, transparent); border-left: 3px solid #22c55e; padding-left: 7px; }
.lfo-diff-add .lfo-diff-code { color: #22c55e; }
.lfo-diff-del { background: color-mix(in srgb, #ef4444 8%, transparent); border-left: 3px solid #ef4444; padding-left: 7px; }
.lfo-diff-del .lfo-diff-code { color: #ef4444; }
.lfo-diff-ctx { color: var(--text-secondary); padding-left: 10px; }
.lfo-suggestion { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 6px 8px; background: color-mix(in srgb, var(--accent) 6%, transparent); border-radius: 6px; font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
.lfo-suggestion-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
.lfo-error-msg { font-size: 13px; color: var(--error); padding: 4px 0; }
@keyframes lfoSpin { to { transform: rotate(360deg); } }
</style>
