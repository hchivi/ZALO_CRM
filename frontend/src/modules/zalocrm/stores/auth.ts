import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api';
import {
  ensureIntegration,
  setStandaloneSession,
  clearStandaloneSession,
  type IntegrationSession,
} from '../integration';

export const useAuthStore = defineStore('crm-standalone-auth', () => {
  const user = ref<IntegrationSession['user'] | null>(null);
  const token = ref<string>(localStorage.getItem('crm:token') || '');
  const needsSetup = ref(false);

  const isAuthenticated = computed(() => !!user.value && !!token.value);
  const isOwner = computed(() => user.value?.role === 'owner');
  const isAdmin = computed(() => ['owner', 'admin'].includes(user.value?.role || ''));

  async function init() {
    const session = await ensureIntegration();
    user.value = session.user;
    token.value = session.token;
  }

  const fetchProfile = init;

  async function checkSetup(): Promise<boolean> {
    try {
      const res = await api.get('/setup/status');
      needsSetup.value = Boolean(res.data?.needsSetup);
      return needsSetup.value;
    } catch {
      return false;
    }
  }

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    setStandaloneSession(res.data.token, res.data.user);
    token.value = res.data.token;
    user.value = res.data.user;
    return res.data;
  }

  async function setup(orgName: string, fullName: string, email: string, password: string) {
    const res = await api.post('/setup', { orgName, fullName, email, password });
    setStandaloneSession(res.data.token, res.data.user);
    token.value = res.data.token;
    user.value = res.data.user;
    needsSetup.value = false;
    return res.data;
  }

  function logout() {
    clearStandaloneSession();
    user.value = null;
    token.value = '';
    window.location.assign('/login');
  }

  return {
    user,
    token,
    needsSetup,
    isAuthenticated,
    isOwner,
    isAdmin,
    init,
    fetchProfile,
    checkSetup,
    logout,
    login,
    setup,
  };
});
