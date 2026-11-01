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
if (process.argv.includes('--history')) {
  const git = (args, options = {}) => execFileSync('git', ['-c', `safe.directory=${safe}`, ...args],
    { cwd: root, maxBuffer: 32 * 1024 * 1024, ...options });
  const objects = git(['rev-list', '--objects', '--all'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const object of objects) {
    const name = object.slice(object.indexOf(' ') + 1);
    assert.ok(!/^(server\/runtime\/|docker\/runtime\/|\.env$|client\/node_modules\/)/.test(name), 'Fichier privé présent dans l’historique');
  }
  const ids = objects.map((line) => line.split(' ')[0]).join('\n') + '\n';
  const types = git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], { input: ids, encoding: 'utf8' });
  const blobs = types.trim().split('\n').filter((line) => line.endsWith(' blob')).map((line) => line.split(' ')[0]);
  const contents = git(['cat-file', '--batch'], { input: blobs.join('\n') + '\n' });
  let offset = 0;
  for (const id of blobs) {
    const end = contents.indexOf(10, offset);
    const size = Number(contents.subarray(offset, end).toString().split(' ')[2]);
    assert.ok(Number.isSafeInteger(size) && size >= 0, 'Réponse Git invalide');
    const content = contents.subarray(end + 1, end + 1 + size);
    for (const secret of secrets.filter((value) => typeof value === 'string' && value.length >= 16)) {
      assert.ok(!content.includes(Buffer.from(secret)), `Secret local détecté dans l’objet ${id} — valeur non affichée`);
    }
    offset = end + 1 + size + 1;
  }
  console.log(`${blobs.length} versions de fichiers contrôlées dans l’historique : aucun secret local connu détecté.`);
}
