// Génère uniquement la configuration locale, jamais les clés E2EE des agents.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(root, '.env');
const configPath = resolve(root, 'docker/runtime/homeserver.yaml');
if (existsSync(envPath) || existsSync(configPath)) {
  console.error('Configuration existante : aucun fichier modifié. Conservez vos secrets.');
  process.exit(1);
}
// L'aléa vient du générateur sécurisé du système via Node, pas d'un algorithme maison.
const secret = () => randomBytes(32).toString('hex');
const password = secret();
const config = {
  server_name: 'messagerie226.local',
  public_baseurl: 'http://localhost:8008/',
  pid_file: '/data/homeserver.pid',
  report_stats: false,
  enable_registration: false,
  allow_guest_access: false,
  presence: { enabled: false },
  federation_domain_whitelist: [],
  trusted_key_servers: [],
  suppress_key_server_warning: true,
  encryption_enabled_by_default_for_room_type: 'all',
  listeners: [{ port: 8008, type: 'http', tls: false, x_forwarded: false,
    bind_addresses: ['0.0.0.0'], resources: [{ names: ['client'], compress: false }] }],
  database: { name: 'psycopg2', args: { user: 'synapse', password,
    database: 'synapse', host: 'postgres', port: 5432, cp_min: 5, cp_max: 10 } },
  media_store_path: '/data/media_store',
  signing_key_path: '/data/messagerie226.local.signing.key',
  macaroon_secret_key: secret(),
  form_secret: secret(),
  registration_shared_secret: secret(),
  max_upload_size: '10M',
  enable_metrics: false,
  modules: [{ module: 'no_plaintext.NoPlaintext', config: {} }],
};
mkdirSync(resolve(root, 'docker/runtime'), { recursive: true });
// JSON est un sous-ensemble valide de YAML, accepté par Synapse.
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
writeFileSync(envPath, `POSTGRES_PASSWORD=${password}\n`, { flag: 'wx', mode: 0o600 });
console.log('Configuration locale créée. Secrets non affichés. Ne pas partager docker/runtime ni .env.');
