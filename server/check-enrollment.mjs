// Tests réels de l'authentification : exclusivement les deux comptes fictifs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const accounts = JSON.parse(readFileSync(new URL('./runtime/demo-accounts.json', import.meta.url)));
const baseUrl = 'http://127.0.0.1:8008';
async function call(path, method = 'GET', body, token) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  return { status: response.status, data: await response.json() };
}
for (const account of accounts) {
  const login = await call('/_matrix/client/v3/login', 'POST', {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: account.username },
    password: account.password, initial_device_display_name: 'Test enrôlement temporaire',
  });
  assert.equal(login.status, 200, `${account.username} doit pouvoir se connecter`);
  const token = login.data.access_token;
  try {
    const me = await call('/_matrix/client/v3/account/whoami', 'GET', undefined, token);
    assert.equal(me.data.user_id, `@${account.username}:messagerie226.local`);
    const admin = await call('/_synapse/admin/v2/users', 'GET', undefined, token);
    assert.equal(admin.status, 403, 'Un agent ne doit pas accéder à l’administration');
  } finally {
    assert.equal((await call('/_matrix/client/v3/logout', 'POST', {}, token)).status, 200);
  }
  assert.equal((await call('/_matrix/client/v3/account/whoami', 'GET', undefined, token)).status, 401);
  console.log(`${account.username} : login, identité, refus admin et invalidation après logout OK`);
}
const intruder = await call('/_matrix/client/v3/login', 'POST', {
  type: 'm.login.password', identifier: { type: 'm.id.user', user: 'intrus.non.enrole' }, password: 'compte-inexistant',
});
assert.equal(intruder.status, 403);
const publicRegistration = await call('/_matrix/client/v3/register', 'POST', {
  username: 'intrus.non.enrole', password: 'compte-inexistant', auth: { type: 'm.login.dummy' },
});
assert.equal(publicRegistration.status, 403);
console.log('Compte non enrôlé et inscription publique refusés OK');
