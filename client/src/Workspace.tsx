import { useEffect, useReducer, useState } from 'react';
import { ClientEvent, EventType, MatrixEventEvent, Preset, RoomEvent, SyncState, Visibility } from 'matrix-js-sdk';
import type { Connection } from './matrix';
import { downloadEncryptedFile, MAX_FILE_SIZE, sendEncryptedFile } from './attachments';

export function Workspace({ connection, onLogout, busy, error }: {
  connection: Connection; onLogout: () => Promise<void>; busy: boolean; error: string;
}) {
  const { client } = connection;
  const [revision, refresh] = useReducer((value) => value + 1, 0);
  const [selected, setSelected] = useState('');
  const [newRoom, setNewRoom] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [roomName, setRoomName] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState('');
  const [encrypted, setEncrypted] = useState(false);
  const [downloading, setDownloading] = useState('');
  const rooms = client.getRooms().filter((room) => ['join', 'invite'].includes(room.getMyMembership()));
  const room = client.getRoom(selected);
  const sync = client.getSyncState();
  const synced = sync === SyncState.Prepared || sync === SyncState.Syncing;

  useEffect(() => {
    client.on(ClientEvent.Sync, refresh);
    client.on(ClientEvent.Room, refresh);
    client.on(RoomEvent.Timeline, refresh);
    client.on(RoomEvent.MyMembership, refresh);
    client.on(MatrixEventEvent.Decrypted, refresh);
    client.on(RoomEvent.LocalEchoUpdated, refresh);
    return () => {
      client.removeListener(ClientEvent.Sync, refresh);
      client.removeListener(ClientEvent.Room, refresh);
      client.removeListener(RoomEvent.Timeline, refresh);
      client.removeListener(RoomEvent.MyMembership, refresh);
      client.removeListener(MatrixEventEvent.Decrypted, refresh);
      client.removeListener(RoomEvent.LocalEchoUpdated, refresh);
    };
  }, [client]);

  useEffect(() => {
    let active = true;
    setEncrypted(false);
    if (selected) void client.getCrypto()?.isEncryptionEnabledInRoom(selected)
      .then((enabled) => { if (active) setEncrypted(enabled); });
    return () => { active = false; };
  }, [client, selected, revision]);

  async function createConversation(event: React.FormEvent) {
    event.preventDefault(); setProblem(''); setWorking(true);
    try {
      const invite = [...new Set(recipients.split(',').map((value) => value.trim()).filter(Boolean))]
        .map((value) => value.startsWith('@') ? value : `@${value}:messagerie226.local`);
      if (!invite.length || invite.some((id) => !/^@[a-z0-9._=-]+:messagerie226\.local$/.test(id) || id === connection.userId)) {
        throw new Error('Indiquez au moins un autre agent local.');
      }
      const created = await client.createRoom({ preset: Preset.PrivateChat, visibility: Visibility.Private,
        invite, is_direct: invite.length === 1 && !roomName.trim(),
        ...(roomName.trim() ? { name: roomName.trim() } : {}),
        initial_state: [
          { type: EventType.RoomEncryption, state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } },
          { type: EventType.RoomHistoryVisibility, state_key: '', content: { history_visibility: 'joined' } },
          { type: EventType.RoomGuestAccess, state_key: '', content: { guest_access: 'forbidden' } },
        ],
      });
      setSelected(created.room_id); setNewRoom(false); setRecipients(''); setRoomName('');
    } catch { setProblem('Création impossible. Vérifiez les identifiants des autres agents et la connexion.'); }
    finally { setWorking(false); refresh(); }
  }

  async function join() {
    setWorking(true); setProblem('');
    try { await client.joinRoom(selected); }
    catch { setProblem('Impossible de rejoindre cette conversation.'); }
    finally { setWorking(false); refresh(); }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !room || working) return;
    setWorking(true); setProblem('');
    try {
      // Vérification au moment de l'envoi : ne jamais se fier au seul cadenas UI.
      if (room.getMyMembership() !== 'join' || !client.getCrypto()
        || !await client.getCrypto()!.isEncryptionEnabledInRoom(selected)) throw new Error('Encryption required');
      await client.sendTextMessage(selected, body);
      setText('');
    } catch { setProblem('Message non envoyé. Vérifiez le chiffrement du salon et la connexion.'); }
    finally { setWorking(false); refresh(); }
  }

  async function attach() {
    if (!file || !room || room.getMyMembership() !== 'join' || !synced) return;
    setWorking(true); setProblem('');
    try { await sendEncryptedFile(client, selected, file); setFile(null); }
    catch { setProblem('Fichier non envoyé. Limite : 5 Mo ; salon chiffré et connexion requis.'); }
    finally { setWorking(false); refresh(); }
  }

  async function download(event: (typeof events)[number]) {
    setDownloading(event.getId() ?? 'file'); setProblem('');
    try { await downloadEncryptedFile(client, event.getContent().file, event.getContent().body); }
    catch { setProblem('Téléchargement ou vérification du fichier impossible.'); }
    finally { setDownloading(''); }
  }

  const events = room?.getLiveTimeline().getEvents().filter((event) =>
    !event.isRedacted() && [EventType.RoomMessage, EventType.RoomMessageEncrypted].includes(event.getType() as EventType)) ?? [];

  return <div className="workspace">
    <header className="workspace-header"><a className="brand" href="/">M<span>226</span></a>
      <div className="agent-summary"><strong>{connection.userId}</strong><span>{synced ? 'Connecté au serveur' : 'Synchronisation en cours…'}</span></div>
      <button className="secondary logout" onClick={() => void onLogout()} disabled={busy}>Se déconnecter</button>
    </header>
    {(error || problem) && <p className="error" role="alert">{error || problem}</p>}
    <main className="workspace-main">
      <aside className="room-list" aria-label="Discussions">
        <div className="list-heading"><h1>Discussions</h1><button className="new-conversation" disabled={!synced} onClick={() => { setNewRoom(true); setProblem(''); }} aria-label="Nouvelle conversation">+</button></div>
        {!rooms.length && <p className="empty-list">Aucune discussion. Créez une conversation avec un autre agent enrôlé.</p>}
        {rooms.map((item) => <button key={item.roomId} className={`room-button ${selected === item.roomId ? 'selected' : ''}`}
          onClick={() => { setSelected(item.roomId); setNewRoom(false); setText(''); setFile(null); setProblem(''); }}>
          <span className="avatar" aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>
          <span><strong>{item.name}</strong><small>{item.getMyMembership() === 'invite' ? 'Invitation à accepter' : `${item.getJoinedMemberCount()} participant(s)`}</small></span>
        </button>)}
      </aside>
      <section className="conversation" aria-label="Conversation">
        {newRoom ? <form className="create-room" onSubmit={(event) => void createConversation(event)}>
          <p className="eyebrow">NOUVEL ÉCHANGE</p><h2>Discussion ou groupe</h2>
          <label htmlFor="recipients">Agents à inviter</label>
          <input id="recipients" placeholder="Ex. agent.b" required value={recipients} onChange={(event) => setRecipients(event.target.value)} disabled={working} />
          <p>Plusieurs identifiants peuvent être séparés par une virgule.</p>
          <label htmlFor="room-name">Nom du groupe (facultatif)</label>
          <input id="room-name" maxLength={100} value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={working} />
          <p>Le nom et la liste des membres sont visibles par le serveur. N’y placez pas d’information confidentielle.</p>
          <button disabled={working}>{working ? 'Création…' : 'Créer la conversation chiffrée'}</button>
          <button type="button" className="secondary" onClick={() => setNewRoom(false)}>Annuler</button>
        </form> : !selected ? <div className="welcome-conversation"><p className="eyebrow">MESSAGERIE SOUVERAINE</p><h2>Vos échanges commencent ici.</h2><p>Sélectionnez une discussion ou créez-en une nouvelle.</p><p className="security-note">Prototype local · comptes fictifs uniquement.<br />Double authentification et vérification des appareils à venir.</p></div>
          : !room ? <p className="welcome-conversation">Chargement de la conversation…</p>
          : room.getMyMembership() === 'invite' ? <div className="welcome-conversation"><h2>{room.name}</h2><p>Vous avez reçu une invitation.</p><button disabled={working || !synced} onClick={() => void join()}>Accepter l’invitation</button></div>
          : <>
            <div className="conversation-heading"><h2>{room.name}</h2><p>{encrypted ? 'Chiffrement du salon activé' : 'Chiffrement non confirmé — envoi bloqué'}</p></div>
            <p className="security-note">Appareils non vérifiés entre participants. Utilisez uniquement des données de démonstration.</p>
            <div className="messages" role="log" aria-label="Messages">
              {!events.length && <p className="empty-list">Aucun message dans cette conversation.</p>}
              {events.map((event) => {
                const body = event.getContent().body;
                const readable = event.isEncrypted() && event.getType() === EventType.RoomMessage && typeof body === 'string';
                return <article className={`message ${event.getSender() === connection.userId ? 'mine' : ''}`} key={event.getId() ?? event.getTxnId()}>
                  <strong>{event.getSender()}</strong>
                  <p>{readable ? body : 'Message chiffré indisponible ou en cours de déchiffrement.'}</p>
                  {readable && event.getContent().msgtype === 'm.file' && event.getContent().file && <button className="secondary" disabled={!!downloading} onClick={() => void download(event)}>{downloading === event.getId() ? 'Déchiffrement…' : 'Télécharger et déchiffrer'}</button>}
                  <small>{new Date(event.getTs()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{event.status ? ` · ${event.status}` : ''}</small>
                </article>;
              })}
            </div>
            <form className="composer" onSubmit={(event) => void send(event)}>
              <label htmlFor="message">Message</label><textarea id="message" maxLength={8000} rows={3} required value={text} onChange={(event) => setText(event.target.value)} disabled={working || !encrypted || !synced} />
              <button disabled={working || !encrypted || !synced || !text.trim()}>{working ? 'Envoi…' : 'Envoyer'}</button>
            </form>
            <div className="attachment"><label htmlFor="attachment">Pièce jointe · 5 Mo maximum</label>
              <input id="attachment" type="file" disabled={working || !encrypted || !synced} onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null; event.target.value = '';
                if (chosen && chosen.size > MAX_FILE_SIZE) { setProblem('Fichier limité à 5 Mo.'); setFile(null); }
                else { setFile(chosen); setProblem(''); }
              }} />
              {file && <p>{file.name} · {Math.ceil(file.size / 1024)} Ko</p>}
              <button className="secondary" disabled={!file || working || !encrypted || !synced} onClick={() => void attach()}>{working ? 'Envoi…' : 'Chiffrer et envoyer le fichier'}</button>
            </div>
          </>}
      </section>
    </main>
  </div>;
}
