<template>
  <v-menu offset-y :close-on-content-click="false" max-width="min(380px, calc(100vw - 16px))">
    <template #activator="{ props: menuProps }">
      <v-btn icon variant="text" size="small" v-bind="menuProps" class="dock-bell-btn" aria-label="Thông báo">
        <v-badge
          :content="notifications.length"
          :model-value="notifications.length > 0"
          class="dock-badge"
          overlap
        >
          <v-icon size="18">mdi-bell-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>
    <v-card style="max-height: 400px; overflow-y: auto;">
      <v-card-title class="text-body-1 font-weight-bold pa-3">Thông báo</v-card-title>
      <v-divider />
      <v-list density="compact" v-if="notifications.length > 0">
        <v-list-item
          v-for="n in notifications"
          :key="n.id"
          @click="handleClick(n)"
          class="py-2"
        >
          <template #prepend>
            <v-icon
              :color="n.type === 'error' ? 'red' : n.type === 'warning' ? 'orange' : 'blue'"
              size="20"
            >
              {{ n.type === 'error' ? 'mdi-alert-circle' : n.type === 'warning' ? 'mdi-alert' : 'mdi-information' }}
            </v-icon>
          </template>
          <v-list-item-title class="text-body-2">{{ n.title }}</v-list-item-title>
          <v-list-item-subtitle class="text-caption">{{ n.detail }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
      <div v-else class="pa-4 text-center text-caption text-grey">Không có thông báo</div>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from '@/modules/zalocrm/router-adapter';
import { api } from '@/modules/zalocrm/api/index';

interface Notification {
  id: string;
  type: string;
  title: string;
  detail: string;
  priority: string;
}

const notifications = ref<Notification[]>([]);
const router = useRouter();
let interval: ReturnType<typeof setInterval>;

async function fetchNotifications() {
  try {
    const res = await api.get('/notifications');
    notifications.value = res.data.notifications || [];
  } catch {
    // silently ignore fetch errors
  }
}

function handleClick(n: Notification) {
  if (n.id === 'unreplied') router.push('/chat');
  else if (n.id.startsWith('apt-')) router.push('/appointments');
  else if (n.id.startsWith('zalo-')) router.push('/zalo-accounts');
  else if (n.id === 'tmr-apts') router.push('/appointments');
}

onMounted(() => {
  fetchNotifications();
  interval = setInterval(fetchNotifications, 60000);
});

onUnmounted(() => clearInterval(interval));
</script>

<style scoped>
.dock-bell-btn {
  color: var(--sidebar-dock-icon, #9EBAAC) !important;
  transition: all 0.18s ease;
}
.dock-bell-btn .v-icon {
  color: inherit !important;
}
.dock-bell-btn:hover {
  color: var(--sidebar-dock-hover, #34D399) !important;
  background: var(--sidebar-dock-hover-bg, rgba(255, 255, 255, 0.12)) !important;
}
:deep(.dock-badge .v-badge__badge) {
  font-size: 10px !important;
  height: 16px !important;
  min-width: 16px !important;
  padding: 0 4px !important;
  background: var(--sidebar-badge-bg, #EF4444) !important;
  color: #FFFFFF !important;
  font-weight: 700 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
}
</style>
