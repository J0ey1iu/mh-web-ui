# Tool UI Component Developer Guide

This guide explains how to create custom UI components for tool call results in the MH Agent frontend.

## Decoupling Design

The frontend is split into **two independent packages** that communicate at runtime via a global registry:

```
mh-application/frontend/          ← The "portal" (host app)
├── src/
│   ├── toolCallRegistry.ts       ← Global registry exposed on window.__MH_TOOL_REGISTRY__ (Map<string, Component>)
│   ├── toolComponentLoader.ts    ← Dynamically loads remote UMD bundles via <script> injection
│   ├── toolComponents.config.ts  ← Multi-source bundle URLs (dev vs production)
│   └── components/               ← Built-in rendering (ToolCallRenderer, BaseToolCard, ToolCallCard, etc.)

mh-application/frontend/component/  ← The "plugin" (standalone component library)
├── src/
│   ├── index.ts                  ← Entry point: imports components and registers them via window.__MH_TOOL_REGISTRY__
│   ├── discover_agents/index.vue
│   ├── handoff/index.vue
│   └── types.ts                  ← Duplicated ToolCallDisplay type (no dependency on portal)
└── vite.config.ts                ← Builds as UMD library with Vue externalized
```

### Key Decoupling Principles

1. **Runtime plugin loading** — Tool components are loaded at runtime via `<script>` injection (`toolComponentLoader.ts`), not imported at build time. The portal never needs rebuild when adding new tool components.

2. **Global registry contract** — The only coupling point is `window.__MH_TOOL_REGISTRY__`, which exposes `register(name, component, options?)` and `get(name)`. The portal initializes it; the plugin calls it. The optional `options` parameter can include `{ autoCollapsible: boolean }` (see [Auto-Collapse Opt-Out](#auto-collapse-opt-out)).

3. **Externalized Vue** — The UMD bundle declares `vue` as external. At runtime it expects Vue's API surface on `window.Vue`, which the portal exposes in `main.ts`. This keeps the bundle tiny and avoids duplicate Vue instances.

4. **Multi-source support** — The portal can load component bundles from multiple sources. Each source is a named entry in `toolComponents.config.ts` with its own URL and can register one or more components. All sources are loaded in parallel.

5. **No source-level dependency** — `component/` is a completely standalone Vite project with its own `package.json`, `vite.config.ts`, and `node_modules`. It does not import from the portal. Shared types (`ToolCallDisplay`) are duplicated.

### Why This Approach?

- **Independent deployability** — Tool component authors can work in `component/` without touching the portal, using `npm run build && npm run preview` for local testing.
- **Zero-config registration** — No import chains, no manual wiring. Write a component, import it in `component/src/index.ts`, and it's automatically available.
- **Error isolation** — If a custom component crashes (`onErrorCaptured` in `ToolCallRenderer`), it falls back to the generic `ToolCallCard` without affecting other messages.
- **Team autonomy** — Different teams can own and deploy their own component bundles independently.

---

## Overview

The tool component rendering pipeline:

```
MessageBubble
  └─ ToolCallRenderer (checks registry for tool.name)
       ├─ Custom component found → wraps in BaseToolCard → renders custom component
       └─ Not found → loads remote bundles → retry
            ├─ Registered now → render custom component
            └─ Still not found → render generic ToolCallCard
```

- **Fallback chain**: Custom component → `ToolCallCard` → error boundary fallback
- **Shared base**: `BaseToolCard` provides consistent styling (card frame, header, spinner, status colors)
- **Built-in folding**: `BaseToolCard` wraps content in `FoldableWrapper` — expand/collapse with chevron, no extra work needed
- **Context injection**: Tool components can access streaming state and session info via `useToolContext()`

---

## Multi-Source Protocol

### Architecture

The portal supports loading component bundles from **multiple independent sources**. Each source is configured in `toolComponents.config.ts`:

```ts
export interface ComponentSource {
  id: string            // unique identifier, e.g. "builtin", "team-alpha"
  label: string         // human-readable name for UI display
  url: string           // production URL for the UMD bundle
  devUrl?: string       // optional dev URL (used when host is localhost)
}

export const COMPONENT_SOURCES: ComponentSource[] = [
  {
    id: "builtin",
    label: "Built-in Components",
    url: "/component/mh-tool-components.umd.js",
  },
  {
    id: "team-alpha",
    label: "Team Alpha Components",
    url: "https://cdn.example.com/team-alpha-components.umd.js",
    devUrl: "http://localhost:4174/mh-tool-components.umd.js",
  },
]
```

### Adding a New Source

1. **Add a config entry** in `web-frontend/src/toolComponents.config.ts` with a unique `id`, a `label`, a production `url`, and optionally a `devUrl` for local development.

2. **Create the component project** as a standalone Vite project (see [Quick Start](#quick-start) below). The project must:
   - Build as a UMD library with `name: "MHToolComponents"` and `vue` externalized
   - Call `window.__MH_TOOL_REGISTRY__.register(name, component)` for each component

3. **For local development**, run `npm run dev` (or `npx vite build --watch`) in the component project and set `devUrl` to the local preview URL (e.g. `http://localhost:4174/mh-tool-components.umd.js`).

4. **For production**, deploy the UMD bundle to a CDN and set `url` to the CDN URL.

### Dev Script Integration

The `scripts/dev.sh` script can build multiple component directories. Set the `COMPONENT_DIRS` environment variable:

```sh
COMPONENT_DIRS="team-alpha:web-frontend/team-alpha team-beta:web-frontend/team-beta" bash scripts/dev.sh
```

Each entry is `output-filename:relative-source-directory`. Bundles are copied to `web-frontend/public/component/`.

### Bundle Contract

Each UMD bundle must:

1. **Register components** via `window.__MH_TOOL_REGISTRY__.register(toolName, component, options?)`. The optional `options` parameter accepts `{ autoCollapsible?: boolean }` — set to `false` to prevent auto-collapse when the response finishes.
2. **Externalize `vue`** — the portal exposes `Vue` on `window.Vue`; the bundle should use `rollupOptions.external: ["vue"]` with `output.globals: { vue: "Vue" }`.
3. **Be a UMD module** — use `formats: ["umd"]` in Vite's `build.lib` config.
4. **Not include `BaseToolCard`** — the portal's `ToolCallRenderer` wraps your component automatically.

---

## Components Demo Page

The portal provides a **Components Demo** page at `/components-demo` for development and debugging.

### Features

- **Source status overview** — Shows all configured component sources, their load state (Idle/Loading/Loaded/Failed), and URLs.
- **Component listing** — Lists every registered component from all sources with its source origin.
- **Mock data testing** — Each component can be tested with custom mock data:
  - Status selector (running / success / error)
  - Progress text input
  - Result text input
- **Live rendering** — Components render inside `BaseToolCard` just as they would in chat, with real-time updates.
- **Per-source reload** — Reload individual sources without refreshing the page.

### How to Use

1. Start the dev server (`bash scripts/dev.sh` or `cd web-frontend && npm run dev`)
2. Navigate to `http://localhost:5173/components-demo`
3. Verify your configured sources appear with ✅ status
4. Find your component in the list
5. Switch between status states and enter mock JSON to verify rendering

The demo page does **not** require authentication, so it works immediately after starting the dev server.

### Frontend-Only Dev Script

For pure component development without backend services, use the dedicated script:

```sh
bash scripts/dev-frontend.sh           # one-shot build, then dev server
bash scripts/dev-frontend.sh --watch   # auto-rebuild on component changes
```

This starts only:
1. The portal Vite dev server on port `5173`
2. Optionally watching the `component/` directory for changes

Navigate to `http://localhost:5173/components-demo` to test components. No backend services (auth, orchestration, etc.) are needed.

---

## Quick Start

### 1. Create a component file

In `component/src/`, create a directory and a Vue component:

```
component/src/<tool_name>/
└── index.vue
```

The directory name (minus path) is the tool name. For example, `discover_agents/index.vue` registers as `"discover_agents"`.

```vue
<script setup lang="ts">
import type { ToolCallDisplay } from "../types"

defineProps<{ tool: ToolCallDisplay }>()
</script>

<template>
  <div>
    <div v-if="tool.progress" class="tool-progress">{{ tool.progress }}</div>
    <div v-if="tool.result" class="tool-result">{{ tool.result }}</div>
  </div>
</template>
```

> The component does NOT include `BaseToolCard` — the portal's `ToolCallRenderer` wraps it automatically.

### 2. Register in the bundle entry

Edit `component/src/index.ts`:

```ts
import YourTool from "./<tool_name>/index.vue"

// ...
registry.register("<tool_name>", YourTool as ToolComponent)
```

If your component should **not** auto-collapse when the response finishes, pass `{ autoCollapsible: false }` as the third argument:

```ts
registry.register("<tool_name>", YourTool as ToolComponent, { autoCollapsible: false })
```

### 3. Provide demo mock data (required)

Each component **must** export a `demoMock` named export containing sample data for the three states (running, success, error). This data is used by the `/components-demo` page to pre-populate mock controls so developers can preview the rendering effect immediately.

Add a `<script>` block (before `<script setup>`) in your `.vue` file:

```vue
<script>
export const demoMock = {
  status: "success",
  progress: "",
  result: JSON.stringify({ status: "ok", result: "sample output" }),
}
</script>

<script setup lang="ts">
// ... component code
</script>
```

The export name **must** be `demoMock` and it **must** conform to the following shape:

```ts
interface ComponentDemoMock {
  status?: "running" | "success" | "error"
  progress?: string
  result?: string
}
```

You may also export `demoMockRunning` and `demoMockError` for additional state previews, though only `demoMock` is required.

The demo page reads this data via `window.__MH_TOOL_REGISTRY__.registerMock(name, mock)` and uses it to initialize the mock controls when the page loads.

### 4. Register in the bundle entry

Edit `component/src/index.ts`:

```ts
import YourTool, { demoMock } from "./<tool_name>/index.vue"

// ...
registry.register("<tool_name>", YourTool as ToolComponent)
registry.registerMock?.("<tool_name>", demoMock)
```

### 5. Build and test

```sh
cd component
npm run build     # produces dist/mh-tool-components.umd.js
npm run preview   # serves on localhost:4173
```

Then open the portal's `/components-demo` page to test your component with the pre-populated demo data.

## ToolCallDisplay Type

Every tool component receives a single prop typed as (duplicated in `component/src/types.ts`):

```ts
interface ToolCallDisplay {
  id: string                        // unique tool call ID
  name: string                      // tool name (matches registration key)
  status: "running" | "success" | "error"
  progress?: string                 // accumulated progress text (streaming)
  result?: string                   // final result (often JSON)
}
```

### Status Lifecycle

| Status | When | What to render |
|--------|------|----------------|
| `running` | Tool is executing | Progress text, spinner |
| `success` | Tool completed | Parsed result |
| `error` | Tool failed | Error message |

## Rendering Context

`ToolCallRenderer` wraps your component in `BaseToolCard`, which provides:

- **Status-colored border** — accent (running), green (success), red (error)
- **Header** with chevron + status icon + tool name + optional spinner
- **Foldable body** via `FoldableWrapper` (see below)

Your component only renders the **body content** inside the card. Do not include `BaseToolCard` yourself.

### Built-in Foldable Behavior

`BaseToolCard` automatically wraps its body content in a `FoldableWrapper`:

- **Default expanded** during streaming, **collapses 1 second after** the response finishes (on `AgentEnd`)
- **Click the header** to toggle expand/collapse at any time (instant, no delay)
- A **chevron** (▶) on the left indicates the fold state — rotates 90° when expanded
- Collapse is a smooth 250ms height transition using `scrollHeight` measurement
- When expanded, content flows naturally with **auto height** — no fixed clipping during streaming
- Messages loaded from history (not freshly streamed) start collapsed immediately with no delay

No extra code needed in your component. The 1-second delay is managed by `MessageBubble` via the `freshlyStreamed` flag on the message.

### Auto-Collapse Opt-Out

If your component should **not** auto-collapse when the response finishes (e.g., a visualization viewer), pass `{ autoCollapsible: false }` as the third argument when registering:

```ts
registry.register("general_visualization", GeneralViz, { autoCollapsible: false })
```

The portal's `BaseToolCard` checks this flag per-tool and will ignore the collapse signal for that component. The user can still manually collapse/expand via the header chevron.

The default is `true` — all components auto-collapse unless explicitly opted out.

## Available CSS Classes

These classes are globally available (defined in `BaseToolCard` — its `<style>` is unscoped):

| Class | Purpose |
|-------|---------|
| `.tool-card` | Card container (status classes `.running`, `.success`, `.error` applied automatically) |
| `.tool-header` | Header flex row |
| `.tool-icon` | Status icon |
| `.tool-name` | Tool name (monospace) |
| `.tool-spinner` | CSS spinner animation |
| `.tool-progress` | Progress text block |
| `.tool-result` | Result text block (pre-wrap, scrollable) |

Any custom styles must be defined in your own component's `<style scoped>`.

## Accessing Tool Context

Tool components can access wider application state:

```ts
import { useToolContext } from "../toolContext"

const { streaming, currentSessionId } = useToolContext()
```

- `streaming` — `Ref<StreamingState>` with `.isStreaming` to know if the current assistant response is still streaming
- `currentSessionId` — `Ref<string | null>` for the active session

This is useful for interactive tools that need to know their rendering phase or make API calls.

## Full Example

```vue
<!-- component/src/bash/index.vue -->
<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"

const props = defineProps<{ tool: ToolCallDisplay }>()

const exitCode = computed(() => {
  if (!props.tool.result) return null
  const match = props.tool.result.match(/^\[Exit (\d+)\]/)
  return match ? parseInt(match[1]) : null
})
</script>

<template>
  <div v-if="tool.status === 'running'" class="tool-progress">
    {{ tool.progress || "Running..." }}
  </div>
  <div v-else-if="tool.status === 'error'" class="tool-result">
    {{ tool.result }}
  </div>
  <div v-else class="bash-output">
    <div v-if="exitCode !== null" :class="['exit-code', exitCode === 0 ? 'success' : 'error']">
      Exit {{ exitCode }}
    </div>
    <pre class="tool-result">{{ tool.result }}</pre>
  </div>
</template>

<style scoped>
.bash-output {
  margin-top: 4px;
}
.exit-code {
  font-family: monospace;
  font-size: 11px;
  margin-bottom: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
}
.exit-code.success {
  background: color-mix(in srgb, var(--success) 20%, transparent);
  color: var(--success);
}
.exit-code.error {
  background: color-mix(in srgb, var(--error) 20%, transparent);
  color: var(--error);
}
pre {
  margin: 0;
}
</style>
```

## Parsing JSON Results

Many tools return JSON in `tool.result`. Parse it safely:

```ts
const data = computed(() => {
  if (!props.tool.result) return null
  try {
    return JSON.parse(props.tool.result)
  } catch {
    return null
  }
})
```

### Parsing Concatenated JSON from Progress

Some tools send structured JSON events in `progress` (one JSON object per SSE chunk). Since chunks are concatenated into a single string, use a brace-depth parser:

```ts
function parseConcatenatedJson(raw: string): Record<string, any>[] {
  const events: Record<string, any>[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        try {
          events.push(JSON.parse(raw.slice(start, i + 1)))
        } catch { /* skip malformed */ }
        start = -1
      }
    }
  }
  return events
}
```

This correctly handles JSON objects even when the values contain `{` / `}` characters (e.g., Markdown content in `message` fields).

## Error Handling

If your component throws during render, the error boundary in `ToolCallRenderer` catches it and falls back to the generic `ToolCallCard`. No other messages are affected.

## Best Practices

1. **Do NOT include BaseToolCard** — `ToolCallRenderer` wraps your component automatically. Just render the body content.
2. **Handle all three statuses** — `running`, `success`, `error`
3. **Always render `tool.progress` during `running`** — progress text carries the streaming execution updates; always show it when present: `<div v-if="tool.progress" class="tool-progress">{{ tool.progress }}</div>`. If the tool doesn't send progress, provide a generic fallback (e.g. `"Running..."`).
4. **Parse JSON safely** — wrap `JSON.parse` in try/catch
5. **Use scoped styles** — your custom CSS should use `<style scoped>`
6. **Use CSS variables for colors** — the app supports multiple themes (Dark, Light, Forest, Sepia). Reference theme variables like `var(--text-primary)`, `var(--text-secondary)`, `var(--surface-raised)`, `var(--border)`, `var(--accent)`, `var(--success)`, `var(--error)` instead of hardcoded hex values. See `docs/theme-dev-guide.md` for the full variable reference.
7. **Keep it focused** — each component handles one tool, one visual
8. **Name directory exactly** — the directory name becomes the tool name (e.g., `discover_agents/` → `"discover_agents"`)
10. **Opt out of auto-collapse when needed** — Components that display persistent content (e.g., a rendered HTML viewer) should pass `{ autoCollapsible: false }` during registration to prevent the 1-second auto-collapse. The default (`true` or omitted) collapses automatically. The user can always manually toggle via the header chevron.

## Fallback Behavior

- If a tool runs during streaming but has no registered component, it shows `ToolCallCard` with raw progress/result
- If a custom component crashes, it falls back to `ToolCallCard`
- The header always shows: chevron + status icon + tool name + spinner (during `running`) — provided by `BaseToolCard`
