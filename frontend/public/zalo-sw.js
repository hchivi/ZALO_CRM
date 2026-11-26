self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'Tin nhắn mới', body: event.data?.text() || '' };
  }

  const title = data.title || 'Zalo & WhatsApp CRM';
  const targetUrl = data.url || ('/crm/cskh/chat' + (data.conversationId ? '?convId=' + encodeURIComponent(data.conversationId) : ''));
  const options = {
    body: data.body || 'Bạn có tin nhắn mới',
    icon: '/images/crm/icon-192.png',
    badge: '/images/crm/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: targetUrl },
    tag: 'zalo-crm-' + (data.conversationId || 'msg'),
    renotify: true
  };

  event.waitUntil((async () => {
    if ('setAppBadge' in self.navigator) {
      if (typeof data.unreadCount === 'number' && data.unreadCount > 0) {
        self.navigator.setAppBadge(data.unreadCount).catch(() => {});
      }
    }
    return self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/crm/cskh/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes('/crm/cskh') && 'focus' in client) {
          if ('navigate' in client && urlToOpen) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
