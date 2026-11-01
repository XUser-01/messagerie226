// À lancer après le build Docker. Aucun mot de passe ni jeton nécessaire.
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8088';
const call = (path) => fetch(base + path, { signal: AbortSignal.timeout(15000) });
const health = await call('/health');
assert.equal(health.status, 200);
const page = await call('/');
assert.equal(page.status, 200);
assert.match(page.headers.get('content-type') || '', /text\/html/);
assert.ok((await page.text()).includes('Messagerie226'));
const csp = page.headers.get('content-security-policy') || '';
assert.ok(csp.includes("frame-ancestors 'none'"));
assert.ok(csp.includes("'wasm-unsafe-eval'"));
const matrix = await call('/_matrix/client/versions');
assert.equal(matrix.status, 200);
assert.ok(Array.isArray((await matrix.json()).versions));
assert.equal((await call('/api/me')).status, 401);
for (const path of ['/server/runtime/control-service.json', '/docker/runtime/homeserver.yaml', '/.env', '/_synapse/admin/v2/users']) {
  assert.equal((await call(path)).status, 404);
}
console.log('Docker web : page, santé, proxy Matrix, API protégée et chemins privés vérifiés.');
console.log('Le test des sessions et du WASM dans le navigateur reste nécessaire sur cette origine.');
