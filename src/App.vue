<script setup lang="ts">
</script>

<template>
  <div class="bg-orbs" aria-hidden="true">
    <div class="bg-orb orb-1" />
    <div class="bg-orb orb-2" />
    <div class="bg-orb orb-3" />
    <div class="bg-orb orb-4" />
    <div class="bg-orb orb-5" />
  </div>
  <router-view />
</template>

<style>
.bg-orbs {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  will-change: transform, opacity;
}

.orb-1 {
  width: 1200px;
  height: 1200px;
  background: radial-gradient(circle, var(--orb-1-center) 0%, transparent 50%);
  top: -40%;
  left: -30%;
  animation: orbFloat1 24s ease-in-out infinite, orbPulse1 9s ease-in-out infinite;
}

.orb-2 {
  width: 1000px;
  height: 1000px;
  background: radial-gradient(circle, var(--orb-2-center) 0%, transparent 50%);
  top: 30%;
  right: -30%;
  animation: orbFloat2 21s ease-in-out infinite, orbPulse2 11s ease-in-out infinite;
}

.orb-3 {
  width: 900px;
  height: 900px;
  background: radial-gradient(circle, var(--orb-3-center) 0%, transparent 50%);
  bottom: -30%;
  left: 20%;
  animation: orbFloat3 27s ease-in-out infinite, orbPulse3 10s ease-in-out infinite;
}

.orb-4 {
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, var(--orb-1-center) 0%, transparent 55%);
  top: -5%;
  right: 15%;
  animation: orbFloat4 30s ease-in-out infinite, orbPulse1 13s ease-in-out infinite;
}

.orb-5 {
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, var(--orb-3-center) 0%, transparent 55%);
  bottom: 10%;
  left: -5%;
  animation: orbFloat5 33s ease-in-out infinite, orbPulse2 15s ease-in-out infinite;
}

@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(100px, 80px) scale(1.04); }
  50% { transform: translate(30px, -50px) scale(0.96); }
  75% { transform: translate(-60px, 20px) scale(1.02); }
}

@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-80px, -60px) scale(1.03); }
  50% { transform: translate(-20px, 50px) scale(0.97); }
  75% { transform: translate(50px, -30px) scale(1.01); }
}

@keyframes orbFloat3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(50px, -80px) scale(1.03); }
  50% { transform: translate(-60px, -20px) scale(0.97); }
  75% { transform: translate(-15px, 60px) scale(1.02); }
}

@keyframes orbFloat4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-80px, 50px) scale(1.04); }
  66% { transform: translate(50px, -40px) scale(0.96); }
}

@keyframes orbFloat5 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-50px, -60px) scale(1.03); }
  66% { transform: translate(60px, 30px) scale(0.97); }
}

@keyframes orbPulse1 {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.4; }
}

@keyframes orbPulse2 {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.28; }
}

@keyframes orbPulse3 {
  0%, 100% { opacity: 0.3; }
  33% { opacity: 0.4; }
  66% { opacity: 0.28; }
}
</style>
