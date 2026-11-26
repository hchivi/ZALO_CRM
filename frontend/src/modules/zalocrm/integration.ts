import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

export interface IntegrationSession {
  token: string;
  brandId?: number;
  expiresAt: number;
  socketUrl: string;
  socketPath: string;
  user: {
    id: string;
    orgId: string;
    email: string;
    fullName: string;
    orgName: string;
    role: string;
  };
}

const TOKEN_KEY = 'crm:token';
const USER_KEY = 'crm:user';

let session: IntegrationSession | null = null;
let pending: Promise<IntegrationSession> | null = null;

export const integrationStorage = {
  getItem: (key: string) => {
    if (key === 'token') return session?.token || localStorage.getItem(TOKEN_KEY) || null;
    return localStorage.getItem(`crm:${key}`);
  },
  setItem: (key: string, value: string) => {
    if (key === 'token') {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.setItem(`crm:${key}`, value);
    }
  },
  removeItem: (key: string) => {
    if (key === 'token') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.removeItem(`crm:${key}`);
    }
  },
};

export function setStandaloneSession(token: string, user: IntegrationSession['user']) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  session = {
    token,
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    socketUrl: (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin,
    socketPath: '/socket.io',
    user,
  };
}

export function clearStandaloneSession() {
  session = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function ensureIntegration(force = false): Promise<IntegrationSession> {
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (!savedToken) {
    throw new Error('Chưa đăng nhập');
  }

  if (!force && session && session.expiresAt > Date.now() + 15000) {
    return session;
  }

  if (!force) {
    const savedUserRaw = localStorage.getItem(USER_KEY);
    if (savedUserRaw) {
      try {
        const parsedUser = JSON.parse(savedUserRaw);
        session = {
          token: savedToken,
          expiresAt: Date.now() + 24 * 3600 * 1000,
          socketUrl: (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin,
          socketPath: '/socket.io',
          user: parsedUser,
        };
        return session;
      } catch {}
    }
  }

  if (pending) return pending;
  pending = (async () => {
    const response = await fetch('/api/v1/profile', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      clearStandaloneSession();
      throw new Error(data?.error || 'Phiên đăng nhập hết hạn.');
    }
    setStandaloneSession(savedToken, data);
    return session!;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

let sharedSocket: Socket | null = null;

export function createSocket(): Socket {
  if (sharedSocket && sharedSocket.connected) {
    return sharedSocket;
  }
  if (sharedSocket && !sharedSocket.connected) {
    sharedSocket.connect();
    return sharedSocket;
  }
  sharedSocket = io(
    session?.socketUrl || (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin,
    {
      path: session?.socketPath || '/socket.io',
      transports: ['websocket', 'polling'],
      auth: async (callback) => {
        try {
          const current = await ensureIntegration(false);
          callback({ token: current.token });
        } catch {
          callback({ token: localStorage.getItem(TOKEN_KEY) || '' });
        }
      },
    },
  );
  return sharedSocket;
}
