<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue"

export interface SelectOption {
  value: any
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: any
  options: SelectOption[]
  placeholder?: string
  searchable?: boolean
  disabled?: boolean
}>(), {
  searchable: true,
  placeholder: "",
})

const emit = defineEmits<{
  "update:modelValue": [value: any]
  change: [value: any]
}>()

const open = ref(false)
const search = ref("")
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

const dropdownStyle = ref<Record<string, string>>({})

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt ? opt.label : ""
})

function updatePosition() {
  if (!open.value || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove

  dropdownStyle.value = {
    position: "fixed",
    top: preferBelow ? `${rect.bottom + 4}px` : `${rect.top - 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: "180px",
  }
}

function select(opt: SelectOption) {
  emit("update:modelValue", opt.value)
  emit("change", opt.value)
  open.value = false
  search.value = ""
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    search.value = ""
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    open.value = false
  }
}

function onDocumentClick(e: MouseEvent) {
  if (open.value && containerRef.value && !containerRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

let scrollCleanup: (() => void) | null = null

function startPositionWatcher() {
  if (!open.value) return
  updatePosition()
  const events = ["scroll", "resize"]
  for (const ev of events) {
    window.addEventListener(ev, updatePosition, { passive: true })
  }
  scrollCleanup = () => {
    for (const ev of events) {
      window.removeEventListener(ev, updatePosition)
    }
  }
}

function stopPositionWatcher() {
  scrollCleanup?.()
  scrollCleanup = null
}

watch(open, (val) => {
  if (val) {
    document.addEventListener("click", onDocumentClick)
    startPositionWatcher()
  } else {
    document.removeEventListener("click", onDocumentClick)
    stopPositionWatcher()
  }
})

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick)
  stopPositionWatcher()
})
</script>

<template>
  <div ref="containerRef" class="ss-wrap" :class="{ 'ss-open': open, 'ss-disabled': disabled }" @keydown="onKeydown">
    <button ref="triggerRef" type="button" class="ss-trigger" :disabled="disabled" @click="toggle">
      <span class="ss-trigger-label" :class="{ 'ss-placeholder': !selectedLabel }">{{ selectedLabel || placeholder }}</span>
      <svg class="ss-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="open" class="ss-dropdown" :style="dropdownStyle" @click.stop>
        <div v-if="searchable" class="ss-search">
          <input v-model="search" type="text" class="ss-search-input" placeholder="Search..." @click.stop @keydown.escape="open = false" />
        </div>
        <div class="ss-options">
          <div
            v-for="opt in filteredOptions"
            :key="opt.value"
            class="ss-option"
            :class="{ 'ss-option-selected': opt.value === modelValue }"
            @click="select(opt)"
          >
            {{ opt.label }}
          </div>
          <div v-if="filteredOptions.length === 0" class="ss-no-results">No results</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ss-wrap {
  position: relative;
  display: inline-block;
  font-family: inherit;
}

.ss-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-highlight);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  white-space: nowrap;
}

.ss-trigger:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.ss-wrap:not(.ss-disabled) .ss-trigger:hover {
  border-color: var(--border-hover);
}

.ss-disabled .ss-trigger {
  opacity: 0.5;
  cursor: not-allowed;
}

.ss-placeholder {
  color: var(--text-tertiary);
}

.ss-arrow {
  flex-shrink: 0;
  transition: transform 0.15s;
  color: var(--text-secondary);
}

.ss-open .ss-arrow {
  transform: rotate(180deg);
}

.ss-dropdown {
  background: var(--surface-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  z-index: 1001;
  animation: ssFadeIn 0.1s ease;
  overflow: hidden;
}

@keyframes ssFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.ss-search {
  padding: 8px;
  border-bottom: 1px solid var(--glass-border);
}

.ss-search-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--glass-highlight);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.ss-search-input:focus {
  border-color: var(--accent);
}

.ss-options {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}

.ss-option {
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.ss-option:hover {
  background: var(--glass-highlight);
}

.ss-option-selected {
  background: var(--accent-dim);
  color: var(--accent);
  font-weight: 500;
}

.ss-no-results {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
