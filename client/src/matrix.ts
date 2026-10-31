import { createClient, type MatrixClient } from 'matrix-js-sdk';

const SESSION_KEY = 'messagerie226.session.v1';
type Session = { userId: string; deviceId: string; accessToken: string };
export type Connection = { client: MatrixClient; userId: string; deviceId: string; release: () => void };

// Évite deux moteurs Rust écrivant simultanément les clés d'un même appareil.
async function lockDevice(name: string): Promise<() => void> {
  if (!navigator.locks) throw new Error('Ce navigateur ne permet pas le verrouillage des clés.');
  return new Promise((resolve, reject) => {
    // Un rechargement peut précéder de peu la libération du verrou de l'ancienne page.
    void navigator.locks.request(name, { signal: AbortSignal.timeout(5000) }, async (lock) => {
      if (!lock) { reject(new Error('Cette session est déjà ouverte dans un autre onglet.')); return; }
      await new Promise<void>((release) => resolve(release));
    }).catch(reject);
  });
}

async function connect(session: Session): Promise<Connection> {
  const release = await lockDevice(`m226:${session.userId}:${session.deviceId}`);
  const client = createClient({ baseUrl: window.location.origin, ...session });
  try {
    // Valider la session avant de charger les clés puis de synchroniser les événements.
    const me = await client.whoami();
    if (me.user_id !== session.userId || me.device_id !== session.deviceId) throw new Error('Session incohérente.');
    await client.initRustCrypto({ useIndexedDB: true,
      cryptoDatabasePrefix: `m226:${session.userId}:${session.deviceId}` });
    if (!client.getCrypto()) throw new Error('Le moteur de chiffrement est indisponible.');
    await client.startClient({ initialSyncLimit: 20 });
    return { client, userId: session.userId, deviceId: session.deviceId, release };
  } catch (error) {
    console.warn('Initialisation Matrix refusée', (error as { name?: string }).name,
      (error as { errcode?: string }).errcode);
    client.stopClient(); release(); throw error;
  }
}

export async function loginAgent(username: string, password: string): Promise<Connection> {
  const auth = createClient({ baseUrl: window.location.origin });
  const result = await auth.loginRequest({ type: 'm.login.password',
    identifier: { type: 'm.id.user', user: username.trim() }, password,
    initial_device_display_name: 'Messagerie226 · navigateur' });
  const session = { userId: result.user_id, deviceId: result.device_id, accessToken: result.access_token };
  let connection: Connection | undefined;
  try {
    connection = await connect(session);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return connection;
  } catch (error) {
    if (connection) { connection.client.stopClient(); connection.release(); }
    // Une initialisation ratée ne doit pas laisser un nouveau jeton actif.
    const failed = createClient({ baseUrl: window.location.origin, ...session });
    await failed.logout().catch(() => undefined);
    throw error;
  }
}

export async function restoreSession(): Promise<Connection | null> {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  const session: unknown = JSON.parse(saved);
  if (!session || typeof session !== 'object' || !('userId' in session) || !('deviceId' in session)
    || !('accessToken' in session) || typeof session.userId !== 'string'
    || typeof session.deviceId !== 'string' || typeof session.accessToken !== 'string') {
    sessionStorage.removeItem(SESSION_KEY); throw new Error('Session locale invalide.');
  }
  return connect(session as Session);
}

export async function logoutAgent(connection: Connection): Promise<void> {
  // Le retrait local n'a lieu qu'après invalidation effective du jeton serveur.
  await connection.client.logout();
  connection.client.stopClient();
  connection.release();
  sessionStorage.removeItem(SESSION_KEY);
}

export function endInvalidSession(connection: Connection): void {
  connection.client.stopClient(); connection.release();
  sessionStorage.removeItem(SESSION_KEY);
}
