// Test HTTP de la politique active ; uniquement données de test fictives.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const account = JSON.parse(readFileSync(new URL('./runtime/demo-accounts.json', import.meta.url)))[0];
let token;
let roomId;
async function call(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:8008${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  return { status: response.status, data: await response.json() };
}
try {
  const login = await call('/_matrix/client/v3/login', 'POST', {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: account.username },
    password: account.password, initial_device_display_name: 'Test politique temporaire',
  });
  assert.equal(login.status, 200, `Login requis (HTTP ${login.status})`);
  token = login.data.access_token;
  const created = await call('/_matrix/client/v3/createRoom', 'POST', {
    preset: 'private_chat', name: 'Vérification technique du filtre',
    initial_state: [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }],
  });
  assert.equal(created.status, 200, 'Création du salon chiffré autorisée');
  roomId = encodeURIComponent(created.data.room_id);
  const encryption = await call(`/_matrix/client/v3/rooms/${roomId}/state/m.room.encryption/`);
  assert.equal(encryption.data.algorithm, 'm.megolm.v1.aes-sha2');
  for (const type of ['m.room.message', 'custom.message']) {
    const denied = await call(`/_matrix/client/v3/rooms/${roomId}/send/${type}/${crypto.randomUUID()}`, 'PUT',
      { msgtype: 'm.text', body: 'TEST TECHNIQUE FICTIF — doit être refusé' });
    assert.equal(denied.status, 403, `${type} en clair doit être refusé`);
    console.log(`${type} : HTTP 403 confirmé`);
  }
  console.log('Politique active vérifiée ; cela ne teste pas encore un échange E2EE.');
} finally {
  if (token && roomId) await call(`/_matrix/client/v3/rooms/${roomId}/leave`, 'POST', {});
  if (token) await call('/_matrix/client/v3/logout', 'POST', {});
}
