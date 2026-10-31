import { useEffect, useState } from 'react';
import { loginAgent, logoutAgent, restoreSession, type Connection } from './matrix';
import { Workspace } from './Workspace';

type ServerState =
  | { phase: 'checking' }
  | { phase: 'ready'; versions: number }
  | { phase: 'failed' };

export function App() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [authError, setAuthError] = useState('');
  const [server, setServer] = useState<ServerState>({ phase: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void restoreSession().then((result) => {
      if (active) setConnection(result);
      else if (result) { result.client.stopClient(); result.release(); }
    }).catch(() => { if (active) setAuthError('Impossible de restaurer la session. Réessayez ou reconnectez-vous.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAuthError('');
    try { setConnection(await loginAgent(username, password)); }
    catch (error) {
      const code = (error as { errcode?: string }).errcode;
      setAuthError(code === 'M_FORBIDDEN' ? 'Identifiant ou mot de passe incorrect.'
        : code === 'M_LIMIT_EXCEEDED' ? 'Trop de tentatives. Patientez avant de réessayer.'
        : 'Connexion impossible. Vérifiez le serveur et fermez les autres onglets de cette session.');
    } finally { setPassword(''); setBusy(false); }
  }

  async function signOut() {
    if (!connection) return;
    setBusy(true); setAuthError('');
    try { await logoutAgent(connection); setConnection(null); }
    catch { setAuthError('Déconnexion non confirmée par le serveur. Réessayez.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setServer({ phase: 'checking' });

    async function checkServer() {
      try {
        const response = await fetch('/_matrix/client/versions', {
          signal: controller.signal, cache: 'no-store',
        });
        if (!response.ok) throw new Error('Server unavailable');
        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null || !('versions' in data)
          || !Array.isArray(data.versions) || data.versions.length === 0
          || !data.versions.every((version: unknown) => typeof version === 'string')) {
          throw new Error('Invalid Matrix response');
        }
        if (active) setServer({ phase: 'ready', versions: data.versions.length });
      } catch {
        if (active) setServer({ phase: 'failed' });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void checkServer();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  if (connection) return <Workspace connection={connection} onLogout={signOut} busy={busy} error={authError} />;

  return (
    <div className="page">
      <header><a className="brand" href="/">M<span>226</span></a><span>Prototype · comptes fictifs uniquement</span></header>
      <main>
        <section className="intro">
          <p className="eyebrow">MESSAGERIE DE L’ADMINISTRATION</p>
          <h1>Un espace commun.<br />Une infrastructure maîtrisée.</h1>
          <p className="lead">Préparation d’une messagerie pour les échanges entre agents, hébergée sur une infrastructure contrôlée.</p>
          <div className="milestone"><span>01</span><div><strong>Le serveur est en place</strong><p>Nous vérifions maintenant sa connexion avec votre navigateur.</p></div></div>
        </section>
        <section className="card" aria-labelledby="connection-title">
          <p className="eyebrow">CONNEXION AU SERVICE</p>
          <h2 id="connection-title">Messagerie souveraine</h2>
          <p>Connectez-vous avec votre compte agent préalablement enrôlé.</p>
          <div className={`status ${server.phase}`} role="status" aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <div><strong>{server.phase === 'ready' ? 'Serveur Matrix accessible' : server.phase === 'checking' ? 'Vérification en cours…' : 'Serveur inaccessible'}</strong>
              <p>{server.phase === 'ready' ? 'La liaison avec Synapse fonctionne.' : server.phase === 'checking' ? 'Connexion à votre serveur local.' : 'Vérifiez que Docker et Synapse sont démarrés, puis réessayez.'}</p>
            </div>
          </div>
          {server.phase === 'failed' && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Vérifier à nouveau</button>}
          {authError && <p className="error" role="alert">{authError}</p>}
          <form onSubmit={(event) => void signIn(event)}>
            <label htmlFor="agent">Identifiant agent</label>
            <input id="agent" autoComplete="username" placeholder="Ex. agent.a" required value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} />
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
            <button disabled={busy || server.phase !== 'ready'}>{busy ? 'Préparation de la session…' : 'Se connecter'}</button>
          </form>
          <div className="notice"><strong>Démonstration · données fictives</strong><p>Connexion par mot de passe. Double authentification et récupération des clés non encore configurées.</p></div>
        </section>
      </main>
      <footer>Messagerie226 <span>Prototype pré-Hackathon · Burkina Faso</span></footer>
    </div>
  );
}
