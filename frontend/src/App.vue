<template>
  <router-view />
  <GlobalLoadingOverlay />
</template>
<script setup lang="ts">
import GlobalLoadingOverlay from '@/modules/zalocrm/components/common/GlobalLoadingOverlay.vue';
// Pure Zalo CRM workspace. Forest Adaptive shell eliminated.
</script>
<style>
.v-application__wrap {
  min-height: 100vh;
  min-height: 100dvh;
}
</style>
