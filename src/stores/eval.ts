import { defineStore } from "pinia"
import { ref } from "vue"
import { createEvalJob, fetchEvalJob, fetchEvalJobs } from "../api/client"
import type { EvalJob, EvalJobConfig, ScenarioDetail, ScenarioInfo } from "../types"

export const useEvalStore = defineStore("eval", () => {
  const jobs = ref<EvalJob[]>([])
  const selectedJob = ref<EvalJob | null>(null)
  const scenarios = ref<ScenarioInfo[]>([])
  const scenarioDetail = ref<ScenarioDetail | null>(null)
  const loading = ref(false)
  const creating = ref(false)
  const error = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function setError(msg: string | null) {
    error.value = msg
  }

  async function loadJobs() {
    loading.value = true
    error.value = null
    try {
      jobs.value = await fetchEvalJobs()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Forbidden")) {
        error.value = "permission_denied"
      } else {
        error.value = msg
      }
    } finally {
      loading.value = false
    }
  }

  async function loadJob(jobId: string) {
    error.value = null
    try {
      selectedJob.value = await fetchEvalJob(jobId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function createJob(config: EvalJobConfig) {
    creating.value = true
    error.value = null
    try {
      const result = await createEvalJob(config)
      await loadJobs()
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      throw err
    } finally {
      creating.value = false
    }
  }

  function startPolling(jobId: string, intervalMs = 2000) {
    stopPolling()
    pollTimer = setInterval(async () => {
      try {
        const job = await fetchEvalJob(jobId)
        selectedJob.value = job
        if (job.status === "completed" || job.status === "failed") {
          stopPolling()
          await loadJobs()
        }
      } catch {
        stopPolling()
      }
    }, intervalMs)
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    jobs,
    selectedJob,
    scenarios,
    scenarioDetail,
    loading,
    creating,
    error,
    setError,
    loadJobs,
    loadJob,
    createJob,
    startPolling,
    stopPolling,
  }
})
