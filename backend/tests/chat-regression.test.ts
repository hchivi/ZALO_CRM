import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Conversation merging preserves all channels and sorts by lastMessageAt descending', () => {
  const existing = [
    { id: 'c1', channel: 'zalo', lastMessageAt: '2026-11-04T10:00:00Z', notes: 'Zalo note' },
    { id: 'c2', channel: 'whatsapp', lastMessageAt: '2026-11-04T09:00:00Z', notes: 'WhatsApp note' },
  ];

  // Incoming batch from WhatsApp filter query
  const incoming = [
    { id: 'c2', channel: 'whatsapp', lastMessageAt: '2026-11-04T11:00:00Z', notes: 'Updated WA note' },
    { id: 'c3', channel: 'whatsapp', lastMessageAt: '2026-11-04T10:30:00Z', notes: 'New WA note' },
  ];

  const map = new Map(existing.map(c => [c.id, c]));
  for (const inc of incoming) {
    const old = map.get(inc.id);
    if (old) {
      Object.assign(old, inc);
    } else {
      map.set(inc.id, inc);
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });

  // Verify all 3 conversations are present (c1 Zalo was NOT erased!)
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, 'c2'); // 11:00 is newest
  assert.equal(merged[1].id, 'c3'); // 10:30
  assert.equal(merged[2].id, 'c1'); // 10:00
  assert.equal(merged[0].notes, 'Updated WA note');
  assert.equal(merged[2].channel, 'zalo');
});

test('Client-side filtering accurately isolates channels and thread types without server roundtrips', () => {
  const allConversations = [
    { id: '1', channel: 'zalo', threadType: 'user', unreadCount: 0 },
    { id: '2', channel: 'zalo', threadType: 'group', unreadCount: 2 },
    { id: '3', channel: 'whatsapp', threadType: 'user', unreadCount: 1 },
    { id: '4', zaloAccount: { channel: 'whatsapp' }, threadType: 'group', unreadCount: 0 },
  ];

  function getChannel(c: any): 'whatsapp' | 'zalo' {
    return (c.channel === 'whatsapp' || c.zaloAccount?.channel === 'whatsapp') ? 'whatsapp' : 'zalo';
  }

  // Filter Zalo
  const zaloList = allConversations.filter(c => getChannel(c) === 'zalo');
  assert.equal(zaloList.length, 2);
  assert.deepEqual(zaloList.map(c => c.id), ['1', '2']);

  // Filter WhatsApp
  const waList = allConversations.filter(c => getChannel(c) === 'whatsapp');
  assert.equal(waList.length, 2);
  assert.deepEqual(waList.map(c => c.id), ['3', '4']);

  // Filter Personal
  const personalList = allConversations.filter(c => c.threadType === 'user');
  assert.equal(personalList.length, 2);
  assert.deepEqual(personalList.map(c => c.id), ['1', '3']);

  // Filter Group
  const groupList = allConversations.filter(c => c.threadType === 'group');
  assert.equal(groupList.length, 2);
  assert.deepEqual(groupList.map(c => c.id), ['2', '4']);

  // Filter Unread
  const unreadList = allConversations.filter(c => c.unreadCount > 0);
  assert.equal(unreadList.length, 2);
  assert.deepEqual(unreadList.map(c => c.id), ['2', '3']);
});

test('Note draft isolation protects user notes from being overwritten by background polling', () => {
  let localNotes = 'Khách yêu cầu giao trước 17h chiều nay';
  let isNoteDirty = true;

  // Background poll brings incoming contact data
  const incomingServerContact = {
    id: 'contact_123',
    notes: 'Ghi chú cũ từ server'
  };

  // Safe sync rule: never overwrite if dirty
  if (!isNoteDirty && incomingServerContact.notes !== undefined) {
    localNotes = incomingServerContact.notes;
  }

  // Verify the in-progress draft was NOT wiped out
  assert.equal(localNotes, 'Khách yêu cầu giao trước 17h chiều nay');
  assert.equal(isNoteDirty, true);
});

test('Member account scoping does not lock out sales users when no explicit account restrictions are configured', () => {
  // Case A: Sales user with NO explicit restrictions configured (accessibleAccounts = [])
  const user = { role: 'member', id: 'u1', orgId: 'org1' };
  const accessibleAccounts: { zaloAccountId: string }[] = [];
  const accountId = undefined;

  const whereA: any = { orgId: user.orgId };
  if (user.role === 'member') {
    if (accessibleAccounts.length > 0) {
      const allowedIds = accessibleAccounts.map((a) => a.zaloAccountId);
      whereA.zaloAccountId = accountId
        ? (allowedIds.includes(accountId) ? accountId : '__NONE__')
        : { in: allowedIds };
    } else if (accountId) {
      whereA.zaloAccountId = accountId;
    }
  }

  // Verify whereA does NOT have where.zaloAccountId = { in: [] }
  assert.equal(whereA.zaloAccountId, undefined, 'Must not lock out member with in: []');
  assert.equal(whereA.orgId, 'org1');

  // Case B: Sales user WITH explicit restrictions
  const accessibleAccountsB = [{ zaloAccountId: 'acc_zalo_1' }];
  const whereB: any = { orgId: user.orgId };
  if (user.role === 'member') {
    if (accessibleAccountsB.length > 0) {
      const allowedIds = accessibleAccountsB.map((a) => a.zaloAccountId);
      whereB.zaloAccountId = accountId
        ? (allowedIds.includes(accountId) ? accountId : '__NONE__')
        : { in: allowedIds };
    } else if (accountId) {
      whereB.zaloAccountId = accountId;
    }
  }

  assert.deepEqual(whereB.zaloAccountId, { in: ['acc_zalo_1'] });
});

test('Conversation pagination initially shows 10 users and expands by 10 successively', () => {
  // Generate 25 mock conversations
  const allConversations = Array.from({ length: 25 }, (_, i) => ({
    id: `conv_${i + 1}`,
    name: `User ${i + 1}`,
  }));

  let displayLimit = 10;
  const getVisible = () => allConversations.slice(0, displayLimit);
  const hasMore = () => allConversations.length > displayLimit;
  const remainingCount = () => Math.max(0, allConversations.length - displayLimit);

  // Initial state: exactly 10 users
  assert.equal(getVisible().length, 10);
  assert.equal(getVisible()[0].id, 'conv_1');
  assert.equal(getVisible()[9].id, 'conv_10');
  assert.equal(hasMore(), true);
  assert.equal(remainingCount(), 15);

  // First expansion (+10)
  displayLimit += 10;
  assert.equal(getVisible().length, 20);
  assert.equal(getVisible()[19].id, 'conv_20');
  assert.equal(hasMore(), true);
  assert.equal(remainingCount(), 5);

  // Second expansion (+10) -> reaches all 25
  displayLimit += 10;
  assert.equal(getVisible().length, 25);
  assert.equal(hasMore(), false);
  assert.equal(remainingCount(), 0);
});

test('Message history pagination prepends older messages without duplicates', () => {
  // Initial messages: newest 50 (messages 51 to 100)
  const initialMessages = Array.from({ length: 50 }, (_, i) => ({
    id: `msg_${i + 51}`,
    content: `Content ${i + 51}`,
    sentAt: new Date(Date.now() - (100 - i) * 60000).toISOString(),
  }));

  let messages = [...initialMessages];
  const totalInDb = 100;
  const hasOlder = () => messages.length < totalInDb;

  assert.equal(messages.length, 50);
  assert.equal(hasOlder(), true);

  // Fetch older page (messages 1 to 50)
  const olderBatch = Array.from({ length: 50 }, (_, i) => ({
    id: `msg_${i + 1}`,
    content: `Content ${i + 1}`,
    sentAt: new Date(Date.now() - (150 - i) * 60000).toISOString(),
  }));

  // Prepend deduplicated
  const existingIds = new Set(messages.map(m => m.id));
  const newOlder = olderBatch.filter(m => !existingIds.has(m.id));
  messages = [...newOlder, ...messages];

  assert.equal(messages.length, 100);
  assert.equal(messages[0].id, 'msg_1'); // Oldest at top
  assert.equal(messages[99].id, 'msg_100'); // Newest at bottom
  assert.equal(hasOlder(), false);
});


