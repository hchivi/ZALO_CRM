import { createSocket } from '@/modules/zalocrm/integration';
/**
 * Composable for Zalo & WhatsApp account management logic:
 * - CRUD operations via REST API
 * - Real-time QR login flow via Socket.IO
 */
import { ref, onUnmounted } from 'vue';
import { api } from '@/modules/zalocrm/api/index';
import { Socket } from 'socket.io-client';

export interface ZaloAccount {
  id: string;
  displayName: string | null;
  zaloUid: string | null;
  channel?: string;
  status: string;
  liveStatus?: string;
  phone: string | null;
  avatarUrl?: string | null;
  sessionData: any;
  ownerUserId: string;
  createdAt: string;
}

export function useZaloAccounts() {
  const accounts = ref<ZaloAccount[]>([]);
  const loading = ref(false);
  const adding = ref(false);
  const deleting = ref(false);

  // Zalo QR dialog state
  const showQRDialog = ref(false);
  const qrImage = ref('');
  const qrScanned = ref(false);
  const scannedName = ref('');
  const qrError = ref('');
  const currentLoginAccountId = ref('');

  // WhatsApp QR dialog state
  const showWhatsAppQRDialog = ref(false);
  const whatsappQrCode = ref('');
  const whatsappConnecting = ref(false);
  const whatsappError = ref('');
  const whatsappPairingCode = ref('');
  const whatsappPairingLoading = ref(false);
  const currentWhatsAppAccountId = ref('');
  let waPollTimer: any = null;

  let socket: Socket | null = null;

  function statusColor(status: string) {
    switch (status) {
      case 'connected': return 'success';
      case 'qr_pending': case 'connecting': return 'warning';
      default: return 'error';
    }
  }

  function statusText(status: string) {
    switch (status) {
      case 'connected': return 'Đã kết nối';
      case 'qr_pending': return 'Chờ QR';
      case 'connecting': return 'Đang kết nối...';
      default: return 'Ngắt kết nối';
    }
  }

  async function fetchAccounts() {
    loading.value = true;
    try {
      const res = await api.get('/zalo-accounts');
      accounts.value = res.data;
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      loading.value = false;
    }
  }

  async function addAccount(displayName: string) {
    adding.value = true;
    try {
      await api.post('/zalo-accounts', { displayName: displayName || undefined });
      await fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
      return true;
    } catch (err: any) {
      console.error('Failed to add account:', err);
      return false;
    } finally {
      adding.value = false;
    }
  }

  async function loginAccount(accountId: string) {
    currentLoginAccountId.value = accountId;
    qrImage.value = '';
    qrScanned.value = false;
    scannedName.value = '';
    qrError.value = '';
    showQRDialog.value = true;
    socket?.emit('zalo:subscribe', { accountId });
    try {
      await api.post(`/zalo-accounts/${accountId}/login`);
    } catch (err: any) {
      qrError.value = err.response?.data?.error || 'Không thể bắt đầu đăng nhập';
    }
  }

  function startPollingWhatsAppQR(accountId: string) {
    if (waPollTimer) clearInterval(waPollTimer);
    waPollTimer = setInterval(async () => {
      if (!showWhatsAppQRDialog.value || currentWhatsAppAccountId.value !== accountId) {
        clearInterval(waPollTimer);
        return;
      }
      try {
        const res = await api.get(`/whatsapp-accounts/${accountId}/qr`);
        if (res.data.status === 'connected') {
          showWhatsAppQRDialog.value = false;
    whatsappPairingCode.value = '';
          clearInterval(waPollTimer);
          await fetchAccounts();
          window.dispatchEvent(new Event('crm:accounts-changed'));
        } else if (res.data.qrCode) {
          whatsappQrCode.value = res.data.qrCode;
        }
      } catch (e) {}
    }, 2000);
  }

  async function addWhatsAppAccount(displayName?: string) {
    whatsappConnecting.value = true;
    whatsappError.value = '';
    whatsappQrCode.value = '';
    showWhatsAppQRDialog.value = true;
    try {
      const res = await api.post('/whatsapp-accounts', {
        displayName: displayName || 'WhatsApp CSKH',
      });
      currentWhatsAppAccountId.value = res.data.id;
      if (res.data.qrCode) {
        whatsappQrCode.value = res.data.qrCode;
      }
      startPollingWhatsAppQR(res.data.id);
      await fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
      return res.data;
    } catch (err: any) {
      whatsappError.value = err.response?.data?.error || err.message || 'Không thể tạo phiên WhatsApp';
      return null;
    } finally {
      whatsappConnecting.value = false;
    }
  }

  async function loginWhatsAppAccount(accountId: string) {
    currentWhatsAppAccountId.value = accountId;
    whatsappQrCode.value = '';
    whatsappError.value = '';
    showWhatsAppQRDialog.value = true;
    whatsappConnecting.value = true;
    try {
      const res = await api.post(`/whatsapp-accounts/${accountId}/login`, {});
      if (res?.data?.qrCode) {
        whatsappQrCode.value = res.data.qrCode;
      }
      startPollingWhatsAppQR(accountId);
    } catch (err: any) {
      whatsappError.value = err.response?.data?.error || err.message || 'Không thể bắt đầu kết nối';
    } finally {
      whatsappConnecting.value = false;
    }
  }

  
  async function requestPairingCode(phoneNumber: string) {
    if (!currentWhatsAppAccountId.value) return null;
    whatsappPairingLoading.value = true;
    whatsappError.value = '';
    whatsappPairingCode.value = '';
    try {
      const res = await api.post(`/whatsapp-accounts/${currentWhatsAppAccountId.value}/pairing-code`, {
        phoneNumber,
      });
      whatsappPairingCode.value = res.data.pairingCode;
      return res.data.pairingCode;
    } catch (err: any) {
      whatsappError.value = err.response?.data?.error || err.message || 'Không thể tạo mã số liên kết';
      return null;
    } finally {
      whatsappPairingLoading.value = false;
    }
  }

  function cancelWhatsAppQR() {
    showWhatsAppQRDialog.value = false;
    if (waPollTimer) {
      clearInterval(waPollTimer);
      waPollTimer = null;
    }
  }

  async function reconnectAccount(accountId: string) {
    try {
      await api.post(`/zalo-accounts/${accountId}/reconnect`);
      await fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
    } catch (err: any) {
      console.error('Reconnect failed:', err);
    }
  }

  async function disconnectAccount(accountId: string) {
    try {
      await api.post(`/zalo-accounts/${accountId}/disconnect`);
      await fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
      return true;
    } catch (err: any) {
      console.error('Disconnect failed:', err);
      return false;
    }
  }

  async function getAccountStats(accountId: string) {
    try {
      const res = await api.get(`/zalo-accounts/${accountId}/stats`);
      return res.data as { conversationCount: number; messageCount: number };
    } catch (err: any) {
      console.error('Failed to get account stats:', err);
      return { conversationCount: 0, messageCount: 0 };
    }
  }

  async function deleteAccount(account: ZaloAccount, purge: boolean = false) {
    deleting.value = true;
    try {
      await api.delete(`/zalo-accounts/${account.id}`, {
        params: { purge: purge ? 'true' : 'false' },
      });
      await fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
      return true;
    } catch (err: any) {
      console.error('Delete failed:', err);
      return false;
    } finally {
      deleting.value = false;
    }
  }

  function cancelQR() {
    showQRDialog.value = false;
    socket?.emit('zalo:unsubscribe', { accountId: currentLoginAccountId.value });
  }

  let registeredHandlers: Array<[string, (...args: any[]) => void]> = [];

  function registerSocketHandler(event: string, handler: (...args: any[]) => void) {
    if (!socket) return;
    socket.on(event, handler);
    registeredHandlers.push([event, handler]);
  }

  function teardownSocket() {
    if (socket) {
      for (const [event, handler] of registeredHandlers) {
        socket.off(event, handler);
      }
      registeredHandlers = [];
      socket = null;
    }
  }

  function setupSocket() {
    teardownSocket();
    socket = createSocket();

    // Zalo events
    registerSocketHandler('zalo:qr', (data: { accountId: string; qrImage: string }) => {
      if (data.accountId === currentLoginAccountId.value) qrImage.value = data.qrImage;
    });

    registerSocketHandler('zalo:scanned', (data: { accountId: string; displayName: string }) => {
      if (data.accountId === currentLoginAccountId.value) {
        qrImage.value = '';
        qrScanned.value = true;
        scannedName.value = data.displayName;
      }
    });

    registerSocketHandler('zalo:connected', (_data: { accountId: string }) => {
      showQRDialog.value = false;
      fetchAccounts();
    });

    registerSocketHandler('zalo:disconnected', (_data: { accountId: string }) => { fetchAccounts(); });

    registerSocketHandler('zalo:error', (data: { accountId: string; error: string }) => {
      if (data.accountId === currentLoginAccountId.value) qrError.value = data.error;
      fetchAccounts();
    });

    registerSocketHandler('zalo:qr-expired', (data: { accountId: string }) => {
      if (data.accountId === currentLoginAccountId.value) {
        qrImage.value = '';
        qrError.value = 'QR đã hết hạn, đang tạo lại...';
      }
    });

    registerSocketHandler('zalo:reconnect-failed', (_data: { accountId: string }) => { fetchAccounts(); });

    // WhatsApp events
    registerSocketHandler('whatsapp:pairing_code', (data: { accountId: string; code: string }) => {
      if (data.accountId === currentWhatsAppAccountId.value) {
        whatsappPairingCode.value = data.code;
      }
    });

    registerSocketHandler('whatsapp:qr', (data: { accountId: string; qrCode: string }) => {
      if (data.accountId === currentWhatsAppAccountId.value) {
        whatsappQrCode.value = data.qrCode;
      }
    });

    registerSocketHandler('whatsapp:connected', (data: { accountId: string }) => {
      if (data.accountId === currentWhatsAppAccountId.value) {
        showWhatsAppQRDialog.value = false;
        if (waPollTimer) {
          clearInterval(waPollTimer);
          waPollTimer = null;
        }
      }
      fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
    });

    registerSocketHandler('whatsapp:disconnected', (_data: { accountId: string }) => {
      fetchAccounts();
      window.dispatchEvent(new Event('crm:accounts-changed'));
    });
  }

  onUnmounted(() => {
    if (waPollTimer) clearInterval(waPollTimer);
    teardownSocket();
  });

  return {
    accounts, loading, adding, deleting,
    showQRDialog, qrImage, qrScanned, scannedName, qrError,
    showWhatsAppQRDialog, whatsappQrCode, whatsappConnecting, whatsappError, whatsappPairingCode, whatsappPairingLoading, currentWhatsAppAccountId, requestPairingCode,
    statusColor, statusText,
    fetchAccounts, addAccount, addWhatsAppAccount, loginAccount, loginWhatsAppAccount,
    reconnectAccount, deleteAccount, disconnectAccount, getAccountStats,
    cancelQR, cancelWhatsAppQR, setupSocket,
  };
}
