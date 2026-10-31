// Enrôlement local uniquement, selon l'API officielle Synapse shared-secret.
// https://element-hq.github.io/synapse/latest/admin_api/register_api.html
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const baseUrl = 'http://127.0.0.1:8008';
const configuration = JSON.parse(readFileSync(new URL('../docker/runtime/homeserver.yaml', import.meta.url)));
const directory = new URL('./runtime/', import.meta.url);
const credentialsPath = new URL('./runtime/demo-accounts.json', import.meta.url);
mkdirSync(directory, { recursive: true });
let accounts;
if (existsSync(credentialsPath)) {
  accounts = JSON.parse(readFileSync(credentialsPath));
} else {
  accounts = ['agent.a', 'agent.b'].map((username, index) => ({
    username, displayname: `Agent fictif ${index === 0 ? 'A' : 'B'}`,
    password: randomBytes(24).toString('base64url'), enrolled: false,
  }));
  writeFileSync(credentialsPath, JSON.stringify(accounts, null, 2), { flag: 'wx', mode: 0o600 });
}

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Synapse HTTP ${response.status} : ${result.errcode ?? 'erreur'}`);
  return result;
}

for (const account of accounts) {
  if (account.enrolled) { console.log(`${account.username} : déjà enrôlé`); continue; }
  const { nonce } = await request('/_synapse/admin/v1/register');
  // HMAC prouve la connaissance du secret d'enrôlement, pas le chiffrement des messages.
  const mac = createHmac('sha1', configuration.registration_shared_secret)
    .update([nonce, account.username, account.password, 'notadmin'].join('\0')).digest('hex');
  await request('/_synapse/admin/v1/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce, username: account.username, password: account.password,
      displayname: account.displayname, admin: false, inhibit_login: true, mac }),
  });
  account.enrolled = true;
  writeFileSync(credentialsPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  console.log(`${account.username} : enrôlé sans droits administrateur`);
}
console.log('Mots de passe locaux : server/runtime/demo-accounts.json (exclu de Git).');
