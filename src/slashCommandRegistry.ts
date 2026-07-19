import { ref, computed } from "vue"
import type { SlashCommand } from "./types"

const commands = ref<Map<string, SlashCommand>>(new Map())
const version = ref(0)

export function registerSlashCommand(cmd: SlashCommand) {
  commands.value.set(cmd.name, cmd)
  version.value++
}

export function unregisterSlashCommand(name: string) {
  commands.value.delete(name)
  version.value++
}

export function getSlashCommand(name: string): SlashCommand | undefined {
  return commands.value.get(name)
}

export const slashCommands = computed(() => {
  return Array.from(commands.value.values())
})

export function filterSlashCommands(filter: string): SlashCommand[] {
  if (!filter) return slashCommands.value
  const lower = filter.toLowerCase()
  return slashCommands.value.filter(
    (c) => c.name.toLowerCase().startsWith(lower) || c.displayName.toLowerCase().includes(lower),
  )
}
