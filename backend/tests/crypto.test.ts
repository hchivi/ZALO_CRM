import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptData, decryptData } from '../src/utils/crypto.js';

test('encryptData produces valid AES-256-GCM format', () => {
  const payload = { imei: '1234567890', cookie: { zpw_sek: 'secret-token' }, userAgent: 'test-ua' };
  const encrypted = encryptData(payload);

  assert.ok(typeof encrypted === 'string');
  assert.ok(encrypted.startsWith('enc:'));
  
  const parts = encrypted.split(':');
  assert.equal(parts.length, 4); // 'enc', iv, authTag, ciphertext
  assert.equal(parts[1].length, 24); // 12-byte IV in hex = 24 chars
  assert.equal(parts[2].length, 32); // 16-byte authTag in hex = 32 chars
});

test('decryptData successfully recovers encrypted objects', () => {
  const original = { imei: 'imei-test-999', cookie: 'sample-cookie-val' };
  const encrypted = encryptData(original);
  const decrypted = decryptData<typeof original>(encrypted);

  assert.deepEqual(decrypted, original);
});

test('decryptData handles legacy unencrypted JSON and plain objects', () => {
  const plainObj = { imei: 'plain-imei', cookie: 'plain-cookie' };
  assert.deepEqual(decryptData(plainObj), plainObj);

  const jsonStr = JSON.stringify(plainObj);
  assert.deepEqual(decryptData(jsonStr), plainObj);

  assert.equal(decryptData(null), null);
  assert.equal(decryptData(undefined), null);
  assert.equal(decryptData(''), null);
});

test('decryptData rejects tampered ciphertext or invalid tag', () => {
  const original = { imei: 'sensitive-imei' };
  const encrypted = encryptData(original);
  const parts = encrypted.split(':');

  // Tamper ciphertext
  const tamperedCipher = parts[0] + ':' + parts[1] + ':' + parts[2] + ':deadbeef' + parts[3].slice(8);
  assert.equal(decryptData(tamperedCipher), null);

  // Tamper auth tag
  const tamperedTag = parts[0] + ':' + parts[1] + ':00112233445566778899aabbccddeeff:' + parts[3];
  assert.equal(decryptData(tamperedTag), null);
});

