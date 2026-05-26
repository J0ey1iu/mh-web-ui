import { defineStore } from "pinia"
import { ref } from "vue"
import { fetchMe } from "../api/client"
import type { UserInfo } from "../types"

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserInfo | null>(null)

  async function checkAuth(): Promise<boolean> {
    try {
      user.value = await fetchMe()
      return true
    } catch {
      user.value = null
      return false
    }
  }

  return { user, checkAuth }
})
