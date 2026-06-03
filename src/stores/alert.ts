import { defineStore } from "pinia"
import { ref } from "vue"

export const useAlertStore = defineStore("alert", () => {
  const message = ref<string | null>(null)
  const isConfirm = ref(false)
  let resolveConfirm: ((v: boolean) => void) | null = null

  function show(msg: string) {
    message.value = msg
    isConfirm.value = false
  }

  function confirm(msg: string): Promise<boolean> {
    message.value = msg
    isConfirm.value = true
    return new Promise((resolve) => {
      resolveConfirm = resolve
    })
  }

  function hide() {
    message.value = null
    isConfirm.value = false
    resolveConfirm = null
  }

  function onConfirm() {
    resolveConfirm?.(true)
    hide()
  }

  function onCancel() {
    resolveConfirm?.(false)
    hide()
  }

  return { message, isConfirm, show, confirm, hide, onConfirm, onCancel }
})
