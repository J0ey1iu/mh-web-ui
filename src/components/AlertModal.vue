<script setup lang="ts">
import { useAlertStore } from "../stores/alert"
import { useI18nStore } from "../stores/i18n"

const alert = useAlertStore()
const { t } = useI18nStore()
</script>

<template>
  <Teleport to="body">
    <div v-if="alert.message" class="alert-overlay" @click.self="alert.isConfirm ? null : alert.hide()">
      <div class="alert-box">
        <div class="alert-icon-wrap">
          <svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <p class="alert-text">{{ alert.message }}</p>
        <div class="alert-actions">
          <button v-if="alert.isConfirm" class="alert-btn btn-cancel" @click="alert.onCancel()">{{ t("alert_cancel") }}</button>
          <button class="alert-btn btn-ok" @click="alert.onConfirm()">{{ t("alert_ok") }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.alert-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  animation: alertFadeIn 0.12s ease;
}

@keyframes alertFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.alert-box {
  background: var(--surface-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 32px 28px 24px;
  width: auto;
  min-width: 280px;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  animation: alertPop 0.2s ease-out;
}

@keyframes alertPop {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.alert-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.alert-icon {
  width: 32px;
  height: 32px;
  color: var(--accent);
  opacity: 0.8;
}

.alert-text {
  margin: 0 0 24px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.alert-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.alert-btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.alert-btn:active {
  transform: scale(0.97);
}

.btn-ok {
  background: var(--accent);
  color: white;
}

.btn-ok:hover {
  background: var(--accent-hover);
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--glass-highlight);
}
</style>
