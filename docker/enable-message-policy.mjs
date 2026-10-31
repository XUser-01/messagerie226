// Migration ciblée de la configuration locale : aucune rotation des secrets.
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('./runtime/homeserver.yaml', import.meta.url);
const text = readFileSync(path, 'utf8');
const config = JSON.parse(text);
const moduleName = 'no_plaintext.NoPlaintext';
config.modules ??= [];
if (config.modules.some((entry) => entry.module === moduleName)) {
  console.log('Politique déjà déclarée. Aucun fichier modifié.');
} else {
  writeFileSync(new URL('./runtime/homeserver.before-policy.json', import.meta.url), text,
    { flag: 'wx', mode: 0o600 });
  config.modules.push({ module: moduleName, config: {} });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  console.log('Politique déclarée. Sauvegarde locale conservée, secrets inchangés. Redémarrage Synapse requis.');
}
