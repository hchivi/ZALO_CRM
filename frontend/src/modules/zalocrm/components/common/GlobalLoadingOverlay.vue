<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isLoading"
        class="crm-global-loading-backdrop"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
      >
        <div class="crm-global-loading-card">
          <!-- Green ring spinner matching image 1 -->
          <div class="crm-spinner-container">
            <div class="crm-green-spinner" />
          </div>
          <h3 class="crm-loading-title">{{ loadingTitle }}</h3>
          <p class="crm-loading-subtitle">{{ loadingSubtitle }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useGlobalLoading } from '@/modules/zalocrm/composables/use-global-loading';

const { isLoading, loadingTitle, loadingSubtitle } = useGlobalLoading();
</script>

<style scoped>
.crm-global-loading-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  user-select: none;
}

.crm-global-loading-card {
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.15), 0 10px 15px -5px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 26px 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 220px;
  max-width: 320px;
  text-align: center;
  animation: cardPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.crm-spinner-container {
  position: relative;
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crm-green-spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3.5px solid rgba(16, 185, 129, 0.18);
  border-top-color: #059669;
  animation: crmSpin 0.8s linear infinite;
}

.crm-loading-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.01em;
}

.crm-loading-subtitle {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: #6b7280;
}

@keyframes crmSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes cardPop {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
