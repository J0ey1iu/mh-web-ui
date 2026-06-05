<script setup lang="ts">
defineProps<{
  active?: boolean
}>()
</script>

<template>
  <div class="branding-header">
    <div class="orb-wrap" :class="{ active }" aria-hidden="true">
      <div class="orb-glow"></div>
      <div class="orb-blob blob-1"></div>
      <div class="orb-blob blob-2"></div>
      <div class="orb-blob blob-3"></div>
    </div>
    <span class="branding-title" :class="{ active }">Minimal Harness</span>
  </div>
</template>

<style scoped>
.branding-header {
  display: flex;
  align-items: center;
  gap: 14px;
  user-select: none;
}

/* ---------- orb 容器 ---------- */
.orb-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  transform: scale(1);
  margin-right: 0;
  filter: saturate(0.7) brightness(0.95);
  transition:
    transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.8s ease,
    margin-right 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.orb-wrap.active {
  transform: scale(2);
  margin-right: 18px;
  filter: saturate(1.4) brightness(1.15);
}

/* ---------- 柔光底座 ---------- */
.orb-glow {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--accent);
  filter: blur(10px);
  opacity: 0.12;
  animation: glowBreathe 17s ease-in-out infinite;
  transition: opacity 0.8s ease;
}

.active .orb-glow {
  opacity: 0.25;
}

@keyframes glowBreathe {
  0%, 100% { opacity: 0.12; transform: scale(0.9); }
  50% { opacity: 0.25; transform: scale(1.15); }
}

/* ---------- 通用 blob ---------- */
.orb-blob {
  position: absolute;
  inset: 2px;
  background-size: 200% 200%;
}

/* blob-1: 主体 */
.blob-1 {
  background: linear-gradient(
    135deg,
    var(--accent-dim) 0%,
    var(--accent) 40%,
    var(--accent-hover) 100%
  );
  animation: morph1 7s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite, bgShift1 5s ease-in-out infinite;
  opacity: 0.9;
}

/* blob-2: 亮部层 */
.blob-2 {
  background: linear-gradient(
    225deg,
    color-mix(in srgb, var(--accent-dim) 60%, #fff) 0%,
    var(--accent) 50%,
    transparent 100%
  );
  animation: morph2 11s cubic-bezier(0.36, 0, 0.64, 1) infinite;
  opacity: 0.55;
}

/* blob-3: 暗部层 */
.blob-3 {
  background: linear-gradient(
    45deg,
    transparent 15%,
    var(--accent) 50%,
    var(--accent-hover) 100%
  );
  animation: morph3 17s cubic-bezier(0.25, 0.1, 0.25, 1) infinite, bgShift3 13s ease-in-out infinite;
  opacity: 0.5;
}

/* ---------- 三组独立的变形动画（极端形变 + 游走） ---------- */
@keyframes morph1 {
  0%   { border-radius: 20% 80% 65% 35% / 75% 25% 75% 25%; transform: translate(0, 0) rotate(0deg); }
  12%  { border-radius: 70% 30% 20% 80% / 35% 80% 20% 65%; transform: translate(5%, -3%) rotate(8deg); }
  31%  { border-radius: 25% 75% 85% 15% / 60% 15% 85% 40%; transform: translate(-3%, 4%) rotate(-5deg); }
  48%  { border-radius: 80% 20% 30% 70% / 25% 65% 35% 75%; transform: translate(4%, 2%) rotate(12deg); }
  63%  { border-radius: 35% 65% 70% 30% / 80% 30% 70% 20%; transform: translate(-5%, -2%) rotate(-8deg); }
  78%  { border-radius: 75% 25% 15% 85% / 30% 70% 30% 70%; transform: translate(3%, 5%) rotate(6deg); }
  91%  { border-radius: 15% 85% 75% 25% / 65% 20% 80% 35%; transform: translate(-2%, -4%) rotate(-10deg); }
  100% { border-radius: 20% 80% 65% 35% / 75% 25% 75% 25%; transform: translate(0, 0) rotate(0deg); }
}

@keyframes morph2 {
  0%   { border-radius: 70% 30% 30% 70% / 20% 80% 20% 80%; transform: translate(0, 0) rotate(0deg); }
  18%  { border-radius: 20% 80% 80% 20% / 70% 20% 80% 30%; transform: translate(-4%, 3%) rotate(-12deg); }
  29%  { border-radius: 80% 20% 25% 75% / 30% 65% 35% 70%; transform: translate(6%, -2%) rotate(10deg); }
  55%  { border-radius: 25% 75% 70% 30% / 80% 20% 80% 20%; transform: translate(-3%, -5%) rotate(-6deg); }
  72%  { border-radius: 65% 35% 20% 80% / 25% 75% 25% 75%; transform: translate(4%, 4%) rotate(15deg); }
  88%  { border-radius: 20% 80% 80% 20% / 60% 30% 70% 40%; transform: translate(-5%, 2%) rotate(-9deg); }
  100% { border-radius: 70% 30% 30% 70% / 20% 80% 20% 80%; transform: translate(0, 0) rotate(0deg); }
}

@keyframes morph3 {
  0%   { border-radius: 60% 40% 25% 75% / 70% 30% 70% 30%; transform: translate(0, 0) rotate(0deg); }
  15%  { border-radius: 15% 85% 70% 30% / 25% 75% 25% 75%; transform: translate(5%, 3%) rotate(10deg); }
  38%  { border-radius: 85% 15% 30% 70% / 60% 25% 75% 40%; transform: translate(-4%, -4%) rotate(-14deg); }
  52%  { border-radius: 30% 70% 80% 20% / 40% 60% 40% 60%; transform: translate(3%, 5%) rotate(8deg); }
  76%  { border-radius: 75% 25% 20% 80% / 20% 80% 20% 80%; transform: translate(-6%, -2%) rotate(-11deg); }
  100% { border-radius: 60% 40% 25% 75% / 70% 30% 70% 30%; transform: translate(0, 0) rotate(0deg); }
}

/* ---------- 渐变背景位移（增加流动感） ---------- */
@keyframes bgShift1 {
  0%, 100% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
}

@keyframes bgShift3 {
  0%, 100% { background-position: 100% 0%; }
  50% { background-position: 0% 100%; }
}

/* ---------- 文字流光 ---------- */
.branding-title {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.4px;
  white-space: nowrap;
  color: var(--text-primary);
  animation: titleShimmer 3s ease-in-out infinite;
  animation-play-state: paused;
}

.branding-title.active {
  background: linear-gradient(
    90deg,
    var(--text-secondary) 0%,
    var(--text-primary) 28%,
    var(--text-strong) 50%,
    var(--text-primary) 72%,
    var(--text-secondary) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation-play-state: running;
}

@keyframes titleShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
