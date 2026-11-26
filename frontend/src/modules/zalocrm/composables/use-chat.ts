import { createSocket } from '@/modules/zalocrm/integration';
import { integrationStorage } from '@/modules/zalocrm/integration';
import { ref, computed, watch } from 'vue';
import { api } from '@/modules/zalocrm/api/index';
import { Socket } from 'socket.io-client';
import type { Contact } from '@/modules/zalocrm/composables/use-contacts';

function unlockAudio() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      ctx.resume().then(() => ctx.close()).catch(() => {});
    }
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playNotificationSound() {
  // Check if sound notifications are muted in integrationStorage
  if (integrationStorage.getItem('crm-sound-enabled') === 'false') return;

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    
    // Crisp double-chime (sine wave)
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      
      // Soft exponential decay
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };
    
    const now = ctx.currentTime;
    // Digital chime: 659.25Hz (E5) then 880Hz (A5)
    playTone(659.25, now, 0.18);
    playTone(880.00, now + 0.08, 0.32);
  } catch (err) {
    console.warn('[sound] Playback failed:', err);
  }
}

interface ZaloAccount {
  id: string;
  displayName: string | null;
  name?: string | null;
  channel?: string;
  status?: string;
}

interface ConversationMessage {
  content: string | null;
  contentType: string;
  senderType: string;
  sentAt: string;
  isDeleted: boolean;
}

export interface Conversation {
  id: string;
  channel?: string;
  threadType: 'user' | 'group';
  groupName?: string | null;
  zaloAccountId?: string;
  contactId?: string | null;
  contact: Contact | null;
  zaloAccount: ZaloAccount | null;
  lastMessageAt: string | null;
  lastMessageSnippet?: string | null;
  unreadCount: number;
  isReplied: boolean;
  isCustomer: boolean;
  quoteCompleted: boolean;
  quoteCompletedByName?: string | null;
  messages?: ConversationMessage[];
  aiMuted?: boolean;
  isMuted?: boolean;
}

export interface Message {
  id: string;
  content: string | null;
  contentType: string;
  senderType: string;
  senderName: string | null;
  sentAt: string;
  isDeleted: boolean;
  zaloMsgId: string | null;
  attachments?: any;
  metadata?: any;
  repliedBy?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
}

export function useChat() {
  const conversations = ref<Conversation[]>([]);
  const selectedConvId = ref<string | null>(null);
  const messages = ref<Message[]>([]);
  const totalMessages = ref(0);
  const messagePage = ref(1);
  const loadingOlderMsgs = ref(false);
  const hasOlderMessages = computed(() => totalMessages.value > messages.value.length);
  const loadingConvs = ref(false);
  const loadingMsgs = ref(false);
  const sendingMsg = ref(false);
  const searchQuery = ref('');
  const accountFilter = ref<string | null>(null);
  const channelFilter = ref<string | null>(null);
  const threadTypeFilter = ref<'user' | 'group' | null>(null);
  const categoryFilter = ref<string | null>(null);
  const statusFilter = ref<string | null>(null);
  const unreadMode = ref(false);
  const tasksMode = ref(false);
  const trackedMode = ref(false);
  watch(selectedConvId, (newId) => {
    if (newId) {
      integrationStorage.setItem('crm-active-conv-id', newId);
    } else {
      integrationStorage.removeItem('crm-active-conv-id');
    }
  });
  let socket: Socket | null = null;
  let refreshInterval: any = null;
  let lastAvatarRefreshTime = 0;

  async function refreshMissingAvatars() {
    try {
      const res = await api.post('/conversations/refresh-missing-avatars');
      if (res.data?.updatedCount > 0) {
        // Silently reload conversations to show real names and avatars
        fetchConversations(true);
      }
      return res.data;
    } catch (e) {
      console.warn('Failed to refresh missing avatars:', e);
    }
  }

  const selectedConv = computed(() =>
    conversations.value.find(c => c.id === selectedConvId.value) || null,
  );

  async function fetchConversations(silent = false) {
    if (!silent) {
      loadingConvs.value = true;
    }
    try {
      const res = await api.get('/conversations', {
        params: {
          limit: 100,
          search: searchQuery.value,
          accountId: accountFilter.value || undefined,
          channel: channelFilter.value || undefined,
          threadType: threadTypeFilter.value || undefined,
          category: categoryFilter.value || undefined,
          status: statusFilter.value || undefined,
          unreadOnly: unreadMode.value ? 'true' : undefined,
          uncompletedOnly: tasksMode.value ? 'true' : (trackedMode.value ? 'tracked' : undefined)
        },
      });
      const incoming = res.data.conversations || [];
      if (searchQuery.value.trim() || conversations.value.length === 0) {
        conversations.value = incoming;
      } else {
        const existingMap = new Map(conversations.value.map(c => [c.id, c]));
        for (const inc of incoming) {
          const old = existingMap.get(inc.id);
          if (old) {
            Object.assign(old, inc);
          } else {
            existingMap.set(inc.id, inc);
          }
        }
        const merged = Array.from(existingMap.values());
        merged.sort((a, b) => {
          const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return timeB - timeA;
        });
        conversations.value = merged;
      }

      // Check if any visible conversation is missing avatar or has placeholder name
      const hasMissingData = incoming.some((c: any) => {
        if (c.channel === 'whatsapp') return false;
        const missingAvatar = !c.contact?.avatarUrl;
        const placeholderName = !c.contact?.fullName || c.contact.fullName === 'Khách hàng' || c.contact.fullName === 'Unknown';
        return missingAvatar || placeholderName || !c.contact;
      });
      if (hasMissingData && Date.now() - lastAvatarRefreshTime > 30000) {
        lastAvatarRefreshTime = Date.now();
        refreshMissingAvatars().catch(() => {});
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      if (!silent) {
        loadingConvs.value = false;
      }
    }
  }

  async function selectConversation(convId: string) {
    selectedConvId.value = convId;
    await fetchMessages(convId);
    // Fetch full conversation detail to populate contact CRM fields
    try {
      const convDetail = await api.get(`/conversations/${convId}`);
      const conv = conversations.value.find(c => c.id === convId);
      const loadedContact = convDetail.data?.contact as Contact | undefined;
      if (conv && loadedContact) {
        conv.contact = loadedContact;
        if (!loadedContact.avatarUrl && conv.channel !== 'whatsapp') {
          api.post(`/conversations/${convId}/refresh-avatar`).then(r => {
            if (r.data?.contact && conv.contact) {
              Object.assign(conv.contact, r.data.contact);
            }
          }).catch(() => {});
        }
      }
    } catch {
      // Non-critical — panel will show partial data from list
    }
    // Mark as read
    try {
      await api.post(`/conversations/${convId}/mark-read`);
      const conv = conversations.value.find(c => c.id === convId);
      if (conv) conv.unreadCount = 0;
      window.dispatchEvent(new Event('crm:unread-changed'));
    } catch {
      // Ignore mark-read errors
    }
  }

  async function fetchMessages(convId: string) {
    loadingMsgs.value = true;
    messagePage.value = 1;
    try {
      const res = await api.get(`/conversations/${convId}/messages`, {
        params: { limit: 50, page: 1 },
      });
      messages.value = res.data.messages || [];
      totalMessages.value = res.data.total ?? messages.value.length;
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      loadingMsgs.value = false;
    }
  }

  async function loadOlderMessages(convId?: string): Promise<number> {
    const id = convId || selectedConvId.value;
    if (!id || loadingOlderMsgs.value || !hasOlderMessages.value) return 0;
    loadingOlderMsgs.value = true;
    try {
      const nextPage = messagePage.value + 1;
      const res = await api.get(`/conversations/${id}/messages`, {
        params: { limit: 50, page: nextPage },
      });
      const olderMessages: Message[] = res.data.messages || [];
      if (olderMessages.length > 0) {
        messagePage.value = nextPage;
        totalMessages.value = res.data.total ?? totalMessages.value;
        const existingIds = new Set(messages.value.map(m => m.id));
        const newOlder = olderMessages.filter(m => !existingIds.has(m.id));
        messages.value = [...newOlder, ...messages.value];
        return newOlder.length;
      }
      return 0;
    } catch (err) {
      console.error('Failed to load older messages:', err);
      return 0;
    } finally {
      loadingOlderMsgs.value = false;
    }
  }

  async function sendMessage(content: string, quoteMessageId?: string) {
    if (!selectedConvId.value || !content.trim()) return;
    if (sendingMsg.value) return;
    sendingMsg.value = true;
    try {
      const res = await api.post(`/conversations/${selectedConvId.value}/messages`, {
        content,
        quoteMessageId,
      });
      const exists = messages.value.find(m => 
        m.id === res.data.id || 
        (res.data.zaloMsgId && m.zaloMsgId === res.data.zaloMsgId) ||
        (res.data.senderType === 'self' && m.senderType === 'self' && m.content === res.data.content && Math.abs(new Date(m.sentAt).getTime() - new Date(res.data.sentAt).getTime()) < 60000)
      );
      if (!exists) {
        messages.value.push(res.data);
      } else {
        const staffRepliedBy = res.data.repliedBy || exists.repliedBy;
        Object.assign(exists, res.data);
        if (staffRepliedBy) exists.repliedBy = staffRepliedBy;
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      sendingMsg.value = false;
    }
  }

  async function forwardMessage(targetConversationIds: string[], messageId: string, extraText?: string) {
    const res = await api.post('/conversations/forward', {
      targetConversationIds,
      messageId,
      extraText,
    });
    return res.data;
  }

  async function recallMessage(messageId: string, skipApi = false) {
    if (!selectedConvId.value) return;
    if (skipApi) {
      const msg = messages.value.find(m => m.id === messageId);
      if (msg) msg.isDeleted = true;
      return;
    }
    const res = await api.post(`/conversations/${selectedConvId.value}/messages/${messageId}/undo`);
    if (res.data?.success && res.data?.zaloSynced !== false) {
      const msg = messages.value.find(m => m.id === messageId);
      if (msg) {
        msg.isDeleted = true;
      }
    }
    return res.data;
  }

  async function deleteMessageForMe(messageId: string, skipApi = false) {
    if (!selectedConvId.value) return;
    if (skipApi) {
      const idx = messages.value.findIndex(m => m.id === messageId);
      if (idx !== -1) messages.value.splice(idx, 1);
      return;
    }
    const res = await api.post(`/conversations/${selectedConvId.value}/messages/${messageId}/delete-for-me`);
    const idx = messages.value.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      messages.value.splice(idx, 1);
    }
    return res.data;
  }

  /** Compress image on client side before upload to speed up sending by 10-30x */
  async function compressImageForUpload(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return file;
    }
    // Do not force-convert PNG or WebP to JPEG on client canvas, as JPEG destroys transparency and creates solid white/black boxes!
    // The backend optimizeImageForSend handles PNG/WebP transparent trimming and optimization safely.
    if (file.type === 'image/png' || file.type === 'image/webp') {
      return file;
    }
    // If image is already smaller than 600 KB, skip compression
    if (file.size <= 600 * 1024) {
      return file;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const newName = file.name.replace(/\.[^.]+$/, '.jpg');
              resolve(new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  async function sendFile(file: File, caption?: string) {
    if (!selectedConvId.value) return;

    // Create optimistic local preview and message immediately for 0ms feedback
    const tempId = `temp_send_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isVoice = file.type.startsWith('audio/') || file.name.includes('voice_record');
    const isImg = !isVoice && file.type.startsWith('image/');
    const isVid = !isVoice && file.type.startsWith('video/');
    const localBlobUrl = (isImg || isVid || isVoice) ? URL.createObjectURL(file) : '';

    let optContent = caption?.trim() || file.name;
    if (isVoice) {
      optContent = JSON.stringify({
        href: localBlobUrl,
        voiceUrl: localBlobUrl,
        action: 'voice',
        durationText: caption?.trim() || '0:00',
        params: {
          m4a: localBlobUrl,
          href: localBlobUrl,
          url: localBlobUrl,
          fileSize: file.size,
        },
      });
    } else if (isImg) {
      optContent = JSON.stringify({
        href: localBlobUrl,
        thumb: localBlobUrl,
        hdUrl: localBlobUrl,
        ...(caption?.trim() ? { title: caption.trim(), caption: caption.trim() } : {}),
      });
    } else if (isVid) {
      optContent = JSON.stringify({
        videoUrl: localBlobUrl,
        thumb: '',
        ...(caption?.trim() ? { title: caption.trim(), caption: caption.trim() } : {}),
      });
    }

    const optimisticMsg: any = {
      id: tempId,
      conversationId: selectedConvId.value,
      senderType: 'self',
      senderName: 'Bạn',
      contentType: isVoice ? 'voice' : (isImg ? 'image' : (isVid ? 'video' : 'file')),
      content: optContent,
      attachments: [{
        fileName: file.name,
        fileSize: file.size,
        url: localBlobUrl,
        localUrl: localBlobUrl,
      }],
      sentAt: new Date().toISOString(),
      isOptimistic: true,
      status: 'sending',
    };

    messages.value.push(optimisticMsg);
    sendingMsg.value = true;

    try {
      // Compress image client-side to dramatically speed up upload and eliminate lag
      let fileToUpload = file;
      if (isImg) {
        fileToUpload = await compressImageForUpload(file);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (caption && caption.trim()) {
        formData.append('content', caption.trim());
      }
      const res = await api.post(`/conversations/${selectedConvId.value}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (isImg && localBlobUrl) {
        if (!res.data.content || res.data.content.includes('"href":""')) {
          res.data.content = JSON.stringify({
            href: localBlobUrl,
            thumb: localBlobUrl,
            hdUrl: localBlobUrl,
            ...(caption?.trim() ? { title: caption.trim(), caption: caption.trim() } : {}),
          });
        }
      }

      // Replace optimistic message with server response
      const optIdx = messages.value.findIndex(m => m.id === tempId);
      if (optIdx !== -1) {
        messages.value[optIdx] = res.data;
      } else {
        const exists = messages.value.find(m => 
          m.id === res.data.id || 
          (res.data.zaloMsgId && m.zaloMsgId === res.data.zaloMsgId)
        );
        if (!exists) {
          messages.value.push(res.data);
        } else {
          Object.assign(exists, res.data);
        }
      }
      if (localBlobUrl && !res.data.content?.includes(localBlobUrl)) {
        URL.revokeObjectURL(localBlobUrl);
      }
    } catch (err) {
      console.error('Failed to send file:', err);
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
      // Remove optimistic message if upload fails
      const optIdx = messages.value.findIndex(m => m.id === tempId);
      if (optIdx !== -1) {
        messages.value.splice(optIdx, 1);
      }
      throw err;
    } finally {
      sendingMsg.value = false;
    }
  }

  let fetchConvDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastChimeTime = 0;
  let handleOnline: (() => void) | null = null;
  let registeredSocketHandlers: Array<[string, (...args: any[]) => void]> = [];

  function registerSocketHandler(event: string, handler: (...args: any[]) => void) {
    if (!socket) return;
    socket.on(event, handler);
    registeredSocketHandlers.push([event, handler]);
  }

  function initSocket() {
    destroySocket();
    socket = createSocket();

    registerSocketHandler('chat:message', (data: { message: Message; conversationId: string; isCatchUp?: boolean }) => {
      // Add to messages if viewing this conversation
      if (data.conversationId === selectedConvId.value) {
        // Avoid duplicates by comparing id, zaloMsgId, OR recent identical self content within 60s
        const exists = messages.value.find(m => 
          m.id === data.message.id || 
          (data.message.zaloMsgId && m.zaloMsgId === data.message.zaloMsgId) ||
          (data.message.senderType === 'self' && m.senderType === 'self' && m.content === data.message.content && Math.abs(new Date(m.sentAt).getTime() - new Date(data.message.sentAt).getTime()) < 60000)
        );
        if (!exists) {
          // If there is an optimistic media message with empty href, replace it!
          const emptyPlaceholderIdx = messages.value.findIndex(m =>
            m.senderType === 'self' &&
            m.content?.startsWith('{') &&
            m.content?.includes('"href":""')
          );
          if (emptyPlaceholderIdx !== -1) {
            messages.value[emptyPlaceholderIdx] = data.message;
          } else {
            messages.value.push(data.message);
          }
        } else {
          // Update details while preserving staff repliedBy if incoming message is missing it
          const staffRepliedBy = exists.repliedBy || data.message.repliedBy;
          Object.assign(exists, data.message);
          if (staffRepliedBy) {
            exists.repliedBy = staffRepliedBy;
          }
        }
      }

      // Play soft digital double-chime if the message is from a customer, not muted, and not a historical catch-up batch
      if (data.message.senderType !== 'self' && !data.isCatchUp) {
        const targetConv = conversations.value.find(c => c.id === data.conversationId);
        if (!targetConv?.isMuted) {
          const now = Date.now();
          if (now - lastChimeTime > 1500) {
            lastChimeTime = now;
            playNotificationSound();
          }
        }
      }

      // Debounce refresh conversation list to update last message / unread count smoothly without flooding
      if (fetchConvDebounceTimer) clearTimeout(fetchConvDebounceTimer);
      fetchConvDebounceTimer = setTimeout(() => {
        fetchConversations(true);
      }, 400);
    });

    registerSocketHandler('chat:deleted', (data: { msgId: string }) => {
      const msgs = messages.value.filter(m => m.zaloMsgId === data.msgId);
      for (const msg of msgs) {
        msg.isDeleted = true;
      }
    });

    registerSocketHandler('chat:message-undo', (data: { messageId?: string; zaloMsgId?: string }) => {
      const msgs = messages.value.filter(m => (data.messageId && m.id === data.messageId) || (data.zaloMsgId && m.zaloMsgId === data.zaloMsgId));
      for (const msg of msgs) {
        msg.isDeleted = true;
      }
    });

    registerSocketHandler('chat:message-deleted', (data: { messageId: string }) => {
      const idx = messages.value.findIndex(m => m.id === data.messageId);
      if (idx !== -1) {
        messages.value.splice(idx, 1);
      }
    });

    registerSocketHandler('chat:reaction', (data: {
      accountId?: string;
      messageId?: string;
      zaloMsgId?: string;
      conversationId?: string;
      reaction: string | null;
      icon?: string;
      senderUid?: string;
      isSelf?: boolean;
    }) => {
      const msg = messages.value.find(m =>
        (data.messageId && m.id === data.messageId) ||
        (data.zaloMsgId && m.zaloMsgId === data.zaloMsgId)
      );

      if (msg) {
        let attList: any[] = [];
        if (msg.attachments) {
          if (typeof msg.attachments === 'string') {
            try { attList = JSON.parse(msg.attachments); } catch { attList = []; }
          } else if (Array.isArray(msg.attachments)) {
            attList = [...msg.attachments];
          } else if (typeof msg.attachments === 'object') {
            attList = [msg.attachments];
          }
        }

        attList = attList.filter((a: any) => a && a.type !== 'reaction');
        if (data.reaction) {
          attList.push({
            type: 'reaction',
            reaction: data.reaction,
            icon: data.icon,
            senderUid: data.senderUid,
            isSelf: data.isSelf,
          });
        }
        msg.attachments = attList;
      }

      window.dispatchEvent(new CustomEvent('crm:message-reaction', { detail: data }));
    });

    registerSocketHandler('conversation:quote-update', (data: { conversationId: string; isCustomer: boolean; quoteCompleted: boolean; quoteCompletedByName?: string | null }) => {
      const convIndex = conversations.value.findIndex(c => c.id === data.conversationId);
      if (convIndex !== -1) {
        if (tasksMode.value && data.quoteCompleted) {
          // Remove from tasks list in real-time!
          conversations.value.splice(convIndex, 1);
          if (selectedConvId.value === data.conversationId) {
            selectedConvId.value = null;
          }
        } else {
          const conv = conversations.value[convIndex];
          conv.isCustomer = data.isCustomer;
          conv.quoteCompleted = data.quoteCompleted;
          conv.quoteCompletedByName = data.quoteCompletedByName;
        }
      } else if (tasksMode.value && data.isCustomer && !data.quoteCompleted) {
        // Reload list to add new customer tasks that were marked incomplete
        fetchConversations(true);
      }
    });

    registerSocketHandler('conversation:ai-update', (data: { conversationId: string; aiMuted: boolean }) => {
      const convIndex = conversations.value.findIndex(c => c.id === data.conversationId);
      if (convIndex !== -1) {
        conversations.value[convIndex].aiMuted = data.aiMuted;
      }
    });

    registerSocketHandler('conversation:mute-update', (data: { conversationId: string; isMuted: boolean }) => {
      const conv = conversations.value.find(c => c.id === data.conversationId);
      if (conv) {
        conv.isMuted = data.isMuted;
      }
    });

    registerSocketHandler('contact:updated', (data: { id?: string; contactId?: string; zaloUid?: string; avatarUrl?: string; fullName?: string; phone?: string }) => {
      const targetId = data.id || data.contactId;
      for (const conv of conversations.value) {
        const matchesId = targetId && conv.contact?.id === targetId;
        const matchesUid = data.zaloUid && (
          conv.contact?.zaloUid === data.zaloUid ||
          (conv.threadType === 'user' && conv.contact?.zaloUid === data.zaloUid) ||
          (conv as any).externalThreadId === data.zaloUid
        );
        if (matchesId || matchesUid) {
          if (conv.contact) {
            if (data.avatarUrl) conv.contact.avatarUrl = data.avatarUrl;
            if (data.fullName && (!conv.contact.fullName || conv.contact.fullName === 'Khách hàng' || conv.contact.fullName === 'Unknown')) {
              conv.contact.fullName = data.fullName;
            }
            if (data.phone && !conv.contact.phone) conv.contact.phone = data.phone;
          }
        }
      }
    });

    // Reconnection handlers: auto catch-up when network recovers silently
    const syncOnReconnect = () => {
      fetchConversations(true);
      if (selectedConvId.value) {
        fetchMessages(selectedConvId.value);
      }
    };

    registerSocketHandler('connect', syncOnReconnect);
    registerSocketHandler('reconnect', syncOnReconnect);
    registerSocketHandler('whatsapp:connected', syncOnReconnect);
    registerSocketHandler('zalo:connected', syncOnReconnect);
    registerSocketHandler('zalo:sync-completed', syncOnReconnect);

    // Browser online detection — instant sync when internet recovers
    handleOnline = () => {
      fetchConversations(true);
      if (selectedConvId.value) {
        fetchMessages(selectedConvId.value);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    // Background polling heartbeat every 30s to guarantee real-time sync silently
    refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchConversations(true);
      }
    }, 30000);
  }

  function destroySocket() {
    if (socket) {
      for (const [event, handler] of registeredSocketHandlers) {
        socket.off(event, handler);
      }
      registeredSocketHandlers = [];
      socket = null;
    }
    if (fetchConvDebounceTimer) {
      clearTimeout(fetchConvDebounceTimer);
      fetchConvDebounceTimer = null;
    }
    if (handleOnline && typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      handleOnline = null;
    }
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  async function toggleMute(convId: string, isMuted: boolean) {
    try {
      const res = await api.patch(`/conversations/${convId}/mute`, { isMuted });
      const conv = conversations.value.find(c => c.id === convId);
      if (conv) {
        conv.isMuted = res.data.isMuted;
      }
      return res.data.isMuted;
    } catch (err) {
      console.error('Failed to toggle mute status:', err);
      throw err;
    }
  }

  async function updateQuoteSettings(convId: string, settings: { isCustomer?: boolean; quoteCompleted?: boolean }) {
    try {
      const res = await api.patch(`/conversations/${convId}/quote-settings`, settings);
      const convIndex = conversations.value.findIndex(c => c.id === convId);
      if (convIndex !== -1) {
        if (tasksMode.value && res.data.quoteCompleted) {
          // Instantly slice it out locally for immediate snappy feel
          conversations.value.splice(convIndex, 1);
          if (selectedConvId.value === convId) {
            selectedConvId.value = null;
          }
        } else {
          const conv = conversations.value[convIndex];
          conv.isCustomer = res.data.isCustomer;
          conv.quoteCompleted = res.data.quoteCompleted;
          conv.quoteCompletedByName = res.data.quoteCompletedByName;
        }
      }
    } catch (err) {
      console.error('Failed to update quote settings:', err);
    }
  }

  return {
    conversations,
    selectedConvId,
    selectedConv,
    messages,
    totalMessages,
    hasOlderMessages,
    loadingOlderMsgs,
    loadingConvs,
    loadingMsgs,
    sendingMsg,
    searchQuery,
    accountFilter,
    channelFilter,
    threadTypeFilter,
    categoryFilter,
    statusFilter,
    unreadMode,
    tasksMode,
    trackedMode,
    fetchConversations,
    selectConversation,
    sendMessage,
    loadOlderMessages,
    forwardMessage,
    recallMessage,
    deleteMessageForMe,
    sendFile,
    initSocket,
    destroySocket,
    toggleMute,
    updateQuoteSettings,
    refreshMissingAvatars,
  };
}
