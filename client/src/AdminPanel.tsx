import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
type Agent = { username: string; userId: string; displayname: string; role: string; revoked: boolean; canRevoke: boolean };

export function AdminPanel({ client }: { client: MatrixClient }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  async function request(path: string, method = 'GET') {
    const response = await fetch(path, { method, headers: { Authorization: `Bearer ${client.getAccessToken()}` },
      signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok) throw new Error('Action refusée ou service indisponible.');
    return response.json();
  }
  async function load() {
    setBusy(true); setError('');
    try { const result = await request('/api/agents'); setAgents(result.agents); }
    catch { setError('Liste inaccessible. Vérifiez vos droits et le service d’administration.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [client]);
  async function revoke(agent: Agent) {
    setBusy(true); setError('');
    try {
      await request(`/api/agents/${encodeURIComponent(agent.username)}/revoke`, 'POST');
      setConfirmation(''); await load();
    } catch { setError('Révocation non confirmée. Actualisez pour vérifier le statut.'); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel" aria-label="Administration">
    <p className="eyebrow">CONTRÔLE DES ACCÈS</p><h1>Agents enrôlés</h1>
    <p>Comptes fictifs de démonstration. La révocation désactive le compte et invalide ses sessions.</p>
    <button className="secondary" disabled={busy} onClick={() => void load()}>Actualiser les statuts</button>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="agent-grid">{agents.map((agent) => <article className="agent-card" key={agent.userId}>
      <h2>{agent.displayname}</h2><p>{agent.userId}</p><p>{agent.role} · <strong>{agent.revoked ? 'Révoqué' : 'Actif'}</strong></p>
      {agent.canRevoke && !agent.revoked && (confirmation === agent.username ? <>
        <p>Confirmer la révocation ? Les anciennes copies des messages ne pourront pas être reprises.</p>
        <button className="danger" disabled={busy} onClick={() => void revoke(agent)}>Confirmer la révocation de {agent.username}</button>
        <button className="secondary" disabled={busy} onClick={() => setConfirmation('')}>Annuler</button>
      </> : <button className="danger" disabled={busy} onClick={() => setConfirmation(agent.username)}>Révoquer {agent.username}</button>)}
    </article>)}</div>
    <p className="security-note">La désactivation ne supprime pas les fichiers ou messages déjà téléchargés. La sortie des salons est traitée par Synapse ; aucune instantanéité absolue des requêtes en cours n’est garantie.</p>
  </section>;
}
