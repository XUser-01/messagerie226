import { useEffect, useState } from 'react';

type ServerState =
  | { phase: 'checking' }
  | { phase: 'ready'; versions: number }
  | { phase: 'failed' };

export function App() {
  const [server, setServer] = useState<ServerState>({ phase: 'checking' });
  const [attempt, setAttempt] = useState(0);

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
          <h2 id="connection-title">Bienvenue sur Messagerie226</h2>
          <p>Première étape : vérifier que votre serveur est accessible.</p>
          <div className={`status ${server.phase}`} role="status" aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <div><strong>{server.phase === 'ready' ? 'Serveur Matrix accessible' : server.phase === 'checking' ? 'Vérification en cours…' : 'Serveur inaccessible'}</strong>
              <p>{server.phase === 'ready' ? 'La liaison avec Synapse fonctionne.' : server.phase === 'checking' ? 'Connexion à votre serveur local.' : 'Vérifiez que Docker et Synapse sont démarrés, puis réessayez.'}</p>
            </div>
          </div>
          <button disabled={server.phase === 'checking'} onClick={() => setAttempt((value) => value + 1)}>Vérifier à nouveau</button>
          <div className="notice"><strong>Prochaine étape : connexion des agents</strong><p>L’authentification et le chiffrement des messages sont en préparation. Cet écran vérifie seulement la disponibilité du serveur.</p></div>
        </section>
      </main>
      <footer>Messagerie226 <span>Prototype pré-Hackathon · Burkina Faso</span></footer>
    </div>
  );
}
