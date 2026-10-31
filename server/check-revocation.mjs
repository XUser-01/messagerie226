// Test réel avec le compte fictif agent.test uniquement, réinitialisé avant le test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const accounts = JSON.parse(readFileSync(new URL('./runtime/demo-accounts.json', import.meta.url)));
const service = JSON.parse(readFileSync(new URL('./runtime/control-service.json', import.meta.url)));
async function request(base, path, method = 'GET', token, body) {
  const start = performance.now();
  const response = await fetch(base + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  return { status: response.status, data: await response.json(), elapsed: performance.now() - start };
}
const matrix = (path, method, token, body) => request('http://127.0.0.1:8008', path, method, token, body);
const api = (path, method, token, body) => request('http://127.0.0.1:3001', path, method, token, body);
async function login(username) {
  const account = accounts.find((item) => item.username === username);
  const result = await matrix('/_matrix/client/v3/login', 'POST', undefined, {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: username }, password: account.password,
    initial_device_display_name: 'Test temporaire de révocation',
  });
  assert.equal(result.status, 200, `Login ${username}`);
  return result.data.access_token;
}
const testAccount = accounts.find((item) => item.username === 'agent.test');
assert.ok(testAccount);
// Réinitialisation limitée au compte explicitement dédié aux tests, jamais A/B.
assert.equal((await matrix('/_synapse/admin/v2/users/' + encodeURIComponent('@agent.test:messagerie226.local'), 'PUT', service.accessToken,
  { deactivated: false, password: testAccount.password, logout_devices: true })).status, 200);
if (process.argv.includes('--prepare-ui')) {
  console.log('agent.test réactivé uniquement pour le scénario navigateur. Aucun autre compte modifié.');
  process.exit(0);
}
let agentToken, managerToken, targetToken;
try {
  agentToken = await login('agent.a'); managerToken = await login('gestionnaire.demo'); targetToken = await login('agent.test');
  assert.equal((await api('/api/agents')).status, 401);
  assert.equal((await api('/api/agents', 'GET', 'jeton-invalide')).status, 401);
  assert.equal((await api('/api/agents', 'GET', agentToken)).status, 403);
  assert.equal((await api('/api/agents/agent.b/revoke', 'POST', agentToken, { role: 'gestionnaire' })).status, 403);
  assert.equal((await api('/api/agents/gestionnaire.demo/revoke', 'POST', managerToken)).status, 403);
  assert.equal((await api('/api/agents/service.admin/revoke', 'POST', managerToken)).status, 403);
  const list = await api('/api/agents', 'GET', managerToken);
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(list.data).includes('accessToken'));
  // Ouvrir un salon auquel le compte ciblé appartient avant révocation.
  const room = await matrix('/_matrix/client/v3/createRoom', 'POST', agentToken, {
    preset: 'private_chat', invite: ['@agent.test:messagerie226.local'],
    initial_state: [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }],
  });
  assert.equal(room.status, 200);
  const roomId = encodeURIComponent(room.data.room_id);
  assert.equal((await matrix(`/_matrix/client/v3/join/${roomId}`, 'POST', targetToken, {})).status, 200);
  assert.equal((await matrix('/_matrix/client/v3/sync?timeout=0', 'GET', targetToken)).status, 200);
  const revoked = await api('/api/agents/agent.test/revoke', 'POST', managerToken, {});
  assert.equal(revoked.status, 200);
  assert.equal(revoked.data.revoked, true);
  const denied = await matrix('/_matrix/client/v3/account/whoami', 'GET', targetToken);
  assert.equal(denied.status, 401);
  assert.equal((await matrix('/_matrix/client/v3/sync?timeout=0', 'GET', targetToken)).status, 401);
  assert.equal((await matrix(`/_matrix/client/v3/rooms/${roomId}/messages?dir=b&limit=1`, 'GET', targetToken)).status, 401);
  assert.equal((await matrix('/_matrix/client/v3/login', 'POST', undefined, {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: 'agent.test' }, password: testAccount.password,
  })).status, 403);
  await matrix(`/_matrix/client/v3/rooms/${roomId}/leave`, 'POST', agentToken, {});
  console.log(`Révocation confirmée en ${Math.round(revoked.elapsed)} ms ; ancien jeton, sync, historique et nouveau login refusés.`);
  console.log('Sans token : 401. Agent ou rôle falsifié : 403. Gestionnaire et compte technique protégés : 403.');
  console.log('agent.test reste révoqué. A/B sont conservés actifs. Ce test ne mesure pas les requêtes déjà en cours.');
} finally {
  for (const token of [agentToken, managerToken]) if (token) await matrix('/_matrix/client/v3/logout', 'POST', token, {});
  if (targetToken) await matrix('/_matrix/client/v3/logout', 'POST', targetToken, {});
}
