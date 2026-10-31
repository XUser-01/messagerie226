// Inspecte les événements bruts que Synapse renvoie, sans déchiffrement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const account = JSON.parse(readFileSync(new URL('./runtime/demo-accounts.json', import.meta.url)))[0];
let token;
async function call(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:8008${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  assert.equal(response.status, 200, `HTTP ${response.status} ${data.errcode ?? ''}`);
  return data;
}
try {
  const login = await call('/_matrix/client/v3/login', 'POST', {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: account.username },
    password: account.password, initial_device_display_name: 'Inspection temporaire des événements',
  });
  token = login.access_token;
  const { joined_rooms: rooms } = await call('/_matrix/client/v3/joined_rooms');
  let count = 0;
  for (const room of rooms) {
    const { chunk } = await call(`/_matrix/client/v3/rooms/${encodeURIComponent(room)}/messages?dir=b&limit=100`);
    for (const event of chunk) {
      assert.notEqual(event.type, 'm.room.message', 'Aucun événement de message en clair attendu');
      if (event.type !== 'm.room.encrypted') continue;
      count++;
      assert.equal(event.content.algorithm, 'm.megolm.v1.aes-sha2');
      assert.ok(event.content.ciphertext);
      assert.equal(event.content.body, undefined);
      assert.ok(!JSON.stringify(event).includes('TEST-E2EE-226-'));
      console.log(`${event.event_id} : enveloppe Megolm, aucun corps lisible`);
    }
  }
  assert.ok(count > 0, 'Envoyer au moins un message chiffré avant ce test');
  console.log(`${count} événement(s) chiffré(s) inspecté(s). Inspection limitée aux 100 derniers événements de chaque salon rejoint.`);
} finally {
  if (token) await call('/_matrix/client/v3/logout', 'POST', {});
}
