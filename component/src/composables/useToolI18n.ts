import { inject, computed } from "vue"

const I18N_KEY = Symbol.for("mh:i18n")

interface I18nContext {
  locale: { value: string }
}

export function useToolI18n(
  messages: Record<string, Record<string, string>>
) {
  const ctx = inject<I18nContext | null>(I18N_KEY, null)
  const locale = computed(() => ctx?.locale?.value ?? "zh")

  function t(key: string, params?: Record<string, string | number>): string {
    let s = messages[locale.value]?.[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(`{${k}}`, String(v))
      }
    }
    return s
  }

  return { t, locale }
}
