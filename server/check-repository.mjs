// Vérifie que ni les fichiers privés ni leurs secrets ne figurent dans les sources.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const safe = root.replace(/\\/g, '/').replace(/\/$/, '');
const files = execFileSync('git', ['-c', `safe.directory=${safe}`, 'ls-files', '--cached', '--others', '--exclude-standard'],
  { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const secrets = [];
for (const name of ['docker/runtime/homeserver.yaml', 'server/runtime/demo-accounts.json', 'server/runtime/control-service.json', 'server/runtime/control-identity.json']) {
  const path = resolve(root, name);
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path));
  if (Array.isArray(data)) secrets.push(...data.map((item) => item.password));
  else secrets.push(data.password, data.accessToken, data.registration_shared_secret, data.macaroon_secret_key,
    data.form_secret, data.database?.args?.password);
}
for (const name of files) {
  assert.ok(!/^(server\/runtime\/|docker\/runtime\/|\.env$|client\/node_modules\/)/.test(name), 'Fichier privé présent dans les sources');
  const content = readFileSync(resolve(root, name));
  for (const secret of secrets.filter((value) => typeof value === 'string' && value.length >= 16)) {
    assert.ok(!content.includes(Buffer.from(secret)), `Secret détecté dans ${name} — valeur non affichée`);
  }
}
console.log(`${files.length} fichiers de source contrôlés : aucun secret local détecté.`);
