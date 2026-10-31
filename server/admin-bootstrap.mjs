// À exécuter localement : le secret d'enrôlement ne quitte jamais le serveur.
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { AGENTS } from './admin-policy.mjs';
const base = 'http://127.0.0.1:8008';
const runtime = new URL('./runtime/', import.meta.url);
mkdirSync(runtime, { recursive: true });
const config = JSON.parse(readFileSync(new URL('../docker/runtime/homeserver.yaml', import.meta.url)));
const accountsPath = new URL('./runtime/demo-accounts.json', import.meta.url);
const botPath = new URL('./runtime/control-service.json', import.meta.url);
const identityPath = new URL('./runtime/control-identity.json', import.meta.url);
const accounts = existsSync(accountsPath) ? JSON.parse(readFileSync(accountsPath)) : [];
async function request(path, body, token) {
  const response = await fetch(base + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Bootstrap HTTP ${response.status} : ${result.errcode ?? 'erreur'}`);
  return result;
}
async function register(account, admin = false) {
  const nonceResponse = await fetch(base + '/_synapse/admin/v1/register', { signal: AbortSignal.timeout(15000) });
  if (!nonceResponse.ok) throw new Error('Nonce d’enrôlement indisponible');
  const { nonce } = await nonceResponse.json();
  const mac = createHmac('sha1', config.registration_shared_secret)
    .update([nonce, account.username, account.password, admin ? 'admin' : 'notadmin'].join('\0')).digest('hex');
  const result = await request('/_synapse/admin/v1/register', { ...account, nonce, admin, mac, inhibit_login: true });
  if (result.access_token) await request('/_matrix/client/v3/logout', {}, result.access_token);
}
for (const agent of AGENTS) {
  let account = accounts.find((item) => item.username === agent.username);
  if (!account) {
    account = { ...agent, password: randomBytes(24).toString('base64url'), enrolled: false };
    accounts.push(account);
    writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  }
  if (!account.enrolled) {
    await register(account);
    account.enrolled = true;
    writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  }
  console.log(`${agent.username} : compte Matrix ordinaire enrôlé`);
}
const previousSession = existsSync(botPath) ? JSON.parse(readFileSync(botPath)) : {};
const bot = existsSync(identityPath) ? JSON.parse(readFileSync(identityPath))
  : previousSession.password ? previousSession
  : { username: 'service.admin', displayname: 'Service technique local', password: randomBytes(32).toString('base64url'), enrolled: false };
delete bot.accessToken;
writeFileSync(identityPath, JSON.stringify(bot, null, 2), { mode: 0o600 });
if (!bot.enrolled) {
  await register(bot, true); bot.enrolled = true;
  writeFileSync(identityPath, JSON.stringify(bot, null, 2), { mode: 0o600 });
}
// Réutiliser le jeton existant s'il reste valide, éviter de créer des sessions inutiles.
let valid = false;
let accessToken = previousSession.accessToken;
if (accessToken) {
  const response = await fetch(base + '/_matrix/client/v3/account/whoami', {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
  valid = response.ok;
}
if (!valid) {
  const login = await request('/_matrix/client/v3/login', { type: 'm.login.password',
    identifier: { type: 'm.id.user', user: bot.username }, password: bot.password,
    initial_device_display_name: 'Service administration — serveur uniquement' });
  accessToken = login.access_token;
}
writeFileSync(botPath, JSON.stringify({ username: bot.username, accessToken }, null, 2), { mode: 0o600 });
console.log('Service administrateur préparé. Aucun jeton ni mot de passe affiché.');
