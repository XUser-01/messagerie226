import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { AGENTS, fullId, roleFor, revocable } from './admin-policy.mjs';

const base = process.env.MATRIX_BASE_URL || 'http://127.0.0.1:8008';
const bot = JSON.parse(readFileSync(process.env.ADMIN_SESSION_FILE || new URL('./runtime/control-service.json', import.meta.url)));
if (!bot.accessToken) throw new Error('Exécuter node server/admin-bootstrap.mjs avant le service.');
const allowedOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:8088', 'http://localhost:8088']);

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
async function matrix(path, token, method = 'GET', body) {
  const response = await fetch(base + path, { method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new HttpError(response.status === 401 ? 401 : 502, 'Requête Matrix refusée ou indisponible.');
  return response.json();
}
async function identity(request) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ') || auth.length > 4096) throw new HttpError(401, 'Connexion requise.');
  const me = await matrix('/_matrix/client/v3/account/whoami', auth.slice(7));
  if (!AGENTS.some((agent) => fullId(agent.username) === me.user_id)) throw new HttpError(403, 'Compte non enrôlé dans cette application.');
  return { userId: me.user_id, role: roleFor(me.user_id) };
}
function reply(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
const server = createServer(async (request, response) => {
  try {
    if (Number(request.headers['content-length'] || 0) > 1024 || request.headers['transfer-encoding']) throw new HttpError(413, 'Requête trop volumineuse.');
    // Aucun CORS permissif ; les requêtes navigateur passent par le même site.
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) throw new HttpError(403, 'Origine refusée.');
    if (request.method === 'GET' && request.url === '/health') return reply(response, 200, { status: 'ok' });
    const actor = await identity(request);
    if (request.method === 'GET' && request.url === '/api/me') return reply(response, 200, actor);
    if (actor.role !== 'gestionnaire') throw new HttpError(403, 'Action réservée au gestionnaire.');
    if (request.method === 'GET' && request.url === '/api/agents') {
      const agents = await Promise.all(AGENTS.map(async (agent) => {
        const user = await matrix(`/_synapse/admin/v2/users/${encodeURIComponent(fullId(agent.username))}`, bot.accessToken);
        return { username: agent.username, userId: fullId(agent.username), displayname: agent.displayname,
          role: roleFor(fullId(agent.username)), revoked: !!user.deactivated, canRevoke: revocable(agent.username) && !user.admin };
      }));
      return reply(response, 200, { agents });
    }
    const match = /^\/api\/agents\/([a-z0-9.]+)\/revoke$/.exec(request.url || '');
    if (request.method === 'POST' && match) {
      const username = match[1];
      if (!revocable(username)) throw new HttpError(403, 'Ce compte ne peut pas être révoqué depuis cette interface.');
      const userId = fullId(username);
      const user = await matrix(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, bot.accessToken);
      if (user.admin) throw new HttpError(403, 'Compte technique protégé.');
      if (!user.deactivated) await matrix(`/_synapse/admin/v1/deactivate/${encodeURIComponent(userId)}`, bot.accessToken, 'POST', { erase: false });
      const updated = await matrix(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, bot.accessToken);
      if (!updated.deactivated) throw new HttpError(502, 'Révocation non confirmée.');
      // Journal minimal : aucune adresse IP, aucun jeton ni contenu de message.
      console.log(JSON.stringify({ action: 'revoke', actor: actor.userId, target: userId, at: new Date().toISOString() }));
      return reply(response, 200, { userId, revoked: true });
    }
    throw new HttpError(404, 'Route introuvable.');
  } catch (error) { reply(response, error instanceof HttpError ? error.status : 503,
    { error: error instanceof HttpError ? error.message : 'Service temporairement indisponible.' }); }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.maxHeadersCount = 30;
server.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log('Service administration démarré.'));
