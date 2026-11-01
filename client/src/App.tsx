import { useEffect, useState } from 'react';
import { endInvalidSession, loginAgent, logoutAgent, restoreSession, type Connection } from './matrix';
import { ClientEvent } from 'matrix-js-sdk';
import { Workspace } from './Workspace';
import { Icon } from './Icon';

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
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const [server, setServer] = useState<ServerState>({ phase: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!retryUntil) return;
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= retryUntil) setRetryUntil(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  useEffect(() => {
    if (!connection) return;
    let active = true;
    function invalid(error: unknown) {
      const code = (error as { errcode?: string })?.errcode;
      if (active && ['M_UNKNOWN_TOKEN', 'M_USER_DEACTIVATED', 'M_MISSING_TOKEN'].includes(code ?? '')) {
        active = false; endInvalidSession(connection!); setConnection(null);
        setAuthError('Session expirée ou accès révoqué. Une reconnexion nécessite un compte actif.');
      }
    }
    const onSync = (_state: unknown, _previous: unknown, data: { error?: unknown } | undefined) => {
      if (data?.error) invalid(data.error);
    };
    connection.client.on(ClientEvent.Sync, onSync);
    const timer = window.setInterval(() => { void connection.client.whoami().catch(invalid); }, 5000);
    return () => { active = false; window.clearInterval(timer); connection.client.removeListener(ClientEvent.Sync, onSync); };
  }, [connection]);

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
    event.preventDefault();
    if (busy || retrySeconds > 0) return;
    setBusy(true); setAuthError('');
    try { setConnection(await loginAgent(username, password)); }
    catch (error) {
      const code = (error as { errcode?: string }).errcode;
      if (code === 'M_LIMIT_EXCEEDED') {
        const wait = (error as { getRetryAfterMs?: () => number | null }).getRetryAfterMs?.() ?? 30000;
        setNow(Date.now()); setRetryUntil(Date.now() + Math.max(1000, wait));
      }
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
      <header><a className="brand" href="/">M<span>226</span><small>MESSAGERIE SOUVERAINE</small></a><span className="prototype-tag">Démonstration · Burkina Faso</span></header>
      <main>
        <section className="intro">
          <p className="eyebrow">UN LIEN ENTRE LES AGENTS</p>
          <h1>Vos échanges.<br />Votre équipe.<br /><em>Votre espace.</em></h1>
          <p className="lead">Un espace commun pour les conversations et les documents de votre équipe, sur une infrastructure auto-hébergée.</p>
          <div className="login-features"><div><Icon name="chat" /><span>Discussions et groupes</span></div><div><Icon name="lock" /><span>Messages et fichiers chiffrés</span></div><div><Icon name="users" /><span>Accès réservés aux agents enrôlés</span></div></div>
          <p className="intro-note">Conçu pour travailler ensemble.<br />Prototype indépendant · données fictives uniquement.</p>
        </section>
        <section className="card" aria-labelledby="connection-title">
          <span className="feature-icon"><Icon name="shield" size={25} /></span><p className="eyebrow">VOTRE ESPACE DE TRAVAIL</p>
          <h2 id="connection-title">Bienvenue.</h2>
          <p>Connectez-vous avec votre compte agent pour retrouver vos échanges.</p>
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
            <button disabled={busy || server.phase !== 'ready' || retrySeconds > 0}>{busy ? 'Préparation de la session…' : retrySeconds ? `Réessayer dans ${retrySeconds} s` : 'Se connecter'}<Icon name="arrow" size={18} /></button>
          </form>
          <div className="notice"><strong>Démonstration · données fictives</strong><p>Connexion par mot de passe. Double authentification et récupération des clés non encore configurées.</p></div>
        </section>
      </main>
      <footer>Messagerie226 <span>Prototype pré-Hackathon · Burkina Faso</span></footer>
    </div>
  );
}
