import { useEffect, useReducer, useRef, useState } from 'react';
import { ClientEvent, EventType, MatrixEventEvent, Preset, RoomEvent, RoomStateEvent, SyncState, Visibility } from 'matrix-js-sdk';
import type { Connection } from './matrix';
import { downloadEncryptedFile, MAX_FILE_SIZE, sendEncryptedFile } from './attachments';
import { AdminPanel } from './AdminPanel';
import { Icon } from './Icon';

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
  const [manager, setManager] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'groups' | 'invites'>('all');
  const [details, setDetails] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const rooms = client.getRooms().filter((room) => ['join', 'invite'].includes(room.getMyMembership()))
    .sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());
  const visibleRooms = rooms.filter((item) => item.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))
    && (filter === 'all' || (filter === 'invites' ? item.getMyMembership() === 'invite' : !!item.currentState.getStateEvents(EventType.RoomName, ''))));
  const agentName = client.getUser(connection.userId)?.displayName || connection.userId.split(':')[0].slice(1);
  const room = client.getRoom(selected);
  const sync = client.getSyncState();
  const synced = sync === SyncState.Prepared || sync === SyncState.Syncing;

  useEffect(() => {
    let active = true;
    void fetch('/api/me', { headers: { Authorization: `Bearer ${client.getAccessToken()}` }, signal: AbortSignal.timeout(10000) })
      .then(async (response) => { if (!response.ok) return; const me = await response.json(); if (active) setManager(me.role === 'gestionnaire'); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    client.on(ClientEvent.Sync, refresh);
    client.on(ClientEvent.Room, refresh);
    client.on(RoomEvent.Timeline, refresh);
    client.on(RoomEvent.MyMembership, refresh);
    client.on(RoomStateEvent.Members, refresh);
    client.on(RoomEvent.Name, refresh);
    client.on(MatrixEventEvent.Decrypted, refresh);
    client.on(RoomEvent.LocalEchoUpdated, refresh);
    return () => {
      client.removeListener(ClientEvent.Sync, refresh);
      client.removeListener(ClientEvent.Room, refresh);
      client.removeListener(RoomEvent.Timeline, refresh);
      client.removeListener(RoomEvent.MyMembership, refresh);
      client.removeListener(RoomStateEvent.Members, refresh);
      client.removeListener(RoomEvent.Name, refresh);
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

  useEffect(() => {
    const area = messagesRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [selected, events.length]);

  return <div className={`workspace ${!showAdmin && (selected || newRoom) ? 'mobile-conversation' : ''}`}>
    <header className="workspace-header"><a className="brand" href="/">M<span>226</span><small>MESSAGERIE SOUVERAINE</small></a>
      <span className={`connection-badge ${synced ? 'online' : ''}`}><i />{synced ? 'Service connecté' : 'Synchronisation…'}</span>
      <div className="agent-summary"><span className="avatar small">{agentName.slice(0, 2).toUpperCase()}</span><div><strong>{agentName}</strong><small>Compte de démonstration</small></div></div>
      <button className="icon-button logout" onClick={() => void onLogout()} disabled={busy} aria-label="Se déconnecter" title="Se déconnecter"><Icon name="logout" /></button>
    </header>
    {(error || problem) && <p className="error workspace-error" role="alert">{error || problem}</p>}
    <div className="app-body">
      <nav className="navigation-rail" aria-label="Navigation principale">
        <button className={!showAdmin ? 'rail-button active' : 'rail-button'} onClick={() => setShowAdmin(false)} aria-label="Discussions" title="Discussions"><Icon name="chat" /><span>Messages</span></button>
        {manager && <button className={showAdmin ? 'rail-button active' : 'rail-button'} onClick={() => setShowAdmin(true)} aria-label="Administration" title="Administration"><Icon name="shield" /><span>Accès</span></button>}
        <div className="rail-foot"><span>BF</span><small>Prototype</small></div>
      </nav>
    {showAdmin && manager ? <AdminPanel client={client} /> : <main className={`workspace-main ${details && room && !newRoom ? 'with-details' : ''}`}>
      <aside className="room-list" aria-label="Discussions">
        <div className="list-heading"><div><p className="eyebrow">VOTRE ESPACE</p><h1>Discussions <span>{rooms.length}</span></h1></div><button className="new-conversation" disabled={!synced} onClick={() => { setNewRoom(true); setProblem(''); }} aria-label="Nouvelle conversation" title="Nouvelle conversation"><Icon name="plus" /></button></div>
        <div className="search-field"><Icon name="search" size={17} /><input aria-label="Rechercher une discussion" placeholder="Rechercher une discussion" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="icon-button" onClick={() => setSearch('')} aria-label="Effacer la recherche"><Icon name="close" size={15} /></button>}</div>
        <div className="room-filters" role="group" aria-label="Filtrer les discussions">{([['all', 'Toutes'], ['groups', 'Groupes nommés'], ['invites', 'Invitations']] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <div className="room-scroll">
        {!rooms.length && <p className="empty-list">Aucune discussion. Créez une conversation avec un autre agent enrôlé.</p>}
        {!!rooms.length && !visibleRooms.length && <p className="empty-list">Aucune discussion trouvée. Essayez un autre nom ou un autre filtre.</p>}
        {visibleRooms.map((item) => <button key={item.roomId} className={`room-button ${selected === item.roomId && !newRoom ? 'selected' : ''}`} aria-current={selected === item.roomId && !newRoom ? 'true' : undefined}
          onClick={() => { setSelected(item.roomId); setNewRoom(false); setText(''); setFile(null); setProblem(''); }}>
          <span className="avatar" aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>
          <span className="room-copy"><strong>{item.name}</strong><small>{item.getMyMembership() === 'invite' ? 'Invitation à accepter' : `${item.getJoinedMemberCount()} participant(s)`}</small></span>
          {item.getMyMembership() === 'invite' ? <span className="invite-dot" aria-label="Invitation" /> : <Icon name="lock" size={13} />}
        </button>)}
        </div><div className="list-footer"><Icon name="shield" size={16} /><span>Infrastructure auto-hébergée<small>Prototype · données fictives</small></span></div>
      </aside>
      <section className="conversation" aria-label="Conversation">
        <button className="mobile-back" onClick={() => { setSelected(''); setNewRoom(false); }}><Icon name="back" size={18} /> Toutes les discussions</button>
        {newRoom ? <form className="create-room" onSubmit={(event) => void createConversation(event)}>
          <span className="feature-icon"><Icon name="plus" size={27} /></span><p className="eyebrow">NOUVEL ÉCHANGE</p><h2>Une nouvelle conversation.</h2><p>Invitez un ou plusieurs agents pour commencer à échanger.</p>
          <label htmlFor="recipients">Agents à inviter</label>
          <input id="recipients" placeholder="Ex. agent.b" required value={recipients} onChange={(event) => setRecipients(event.target.value)} disabled={working} />
          <p>Plusieurs identifiants peuvent être séparés par une virgule.</p>
          <label htmlFor="room-name">Nom du groupe (facultatif)</label>
          <input id="room-name" maxLength={100} value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={working} />
          <p>Le nom et la liste des membres sont visibles par le serveur. N’y placez pas d’information confidentielle.</p>
          <button disabled={working}>{working ? 'Création…' : 'Créer la conversation chiffrée'}</button>
          <button type="button" className="secondary" onClick={() => setNewRoom(false)}>Annuler</button>
        </form> : !selected ? <div className="welcome-conversation"><div className="welcome-art"><Icon name="chat" size={54} /><span><Icon name="lock" size={20} /></span></div><p className="eyebrow">PROCHES DANS L’ÉCHANGE</p><h2>Un espace pour<br />travailler ensemble.</h2><p>Retrouvez vos discussions à gauche, ou invitez un agent à une nouvelle conversation.</p><button className="welcome-action" disabled={!synced} onClick={() => setNewRoom(true)}><Icon name="plus" size={18} /> Nouvelle conversation</button><p className="welcome-caption"><Icon name="lock" size={14} /> Messages chiffrés dans les salons compatibles.</p><p className="security-note">Données fictives uniquement. Vérification des appareils et récupération des clés à venir.</p></div>
          : !room ? <p className="welcome-conversation">Chargement de la conversation…</p>
          : room.getMyMembership() === 'invite' ? <div className="welcome-conversation"><h2>{room.name}</h2><p>Vous avez reçu une invitation.</p><button disabled={working || !synced} onClick={() => void join()}>Accepter l’invitation</button></div>
          : <>
            <div className="conversation-heading"><span className="avatar">{room.name.slice(0, 2).toUpperCase()}</span><div><h2>{room.name}</h2><p>{room.getJoinedMemberCount()} participant(s) <span>·</span> {encrypted ? 'Salon chiffré' : 'Envoi bloqué'}</p></div><button className={`icon-button ${details ? 'is-active' : ''}`} onClick={() => setDetails(!details)} aria-label="Informations de la conversation" aria-expanded={details} title="Informations de la conversation"><Icon name="info" /></button></div>
            <p className="security-note conversation-notice"><Icon name="lock" size={14} /><span>{encrypted ? 'Chiffrement activé.' : 'Chiffrement non confirmé : envoi bloqué.'} Appareils non vérifiés · données fictives uniquement.</span></p>
            <div className="messages" ref={messagesRef} role="log" aria-label="Messages">
              <div className="timeline-start"><span>Messages de la conversation</span></div>
              {!events.length && <p className="empty-list">Aucun message dans cette conversation.</p>}
              {events.map((event) => {
                const body = event.getContent().body;
                const readable = event.isEncrypted() && !event.isDecryptionFailure() && event.getType() === EventType.RoomMessage && typeof body === 'string';
                return <article className={`message ${event.getSender() === connection.userId ? 'mine' : ''}`} key={event.getId() ?? event.getTxnId()}>
                  <strong title={event.getSender() ?? ''}>{event.getSender() === connection.userId ? 'Vous' : room.getMember(event.getSender() ?? '')?.name || event.getSender()}</strong>
                  {readable && event.getContent().msgtype === 'm.file' ? <div className="file-message"><span className="file-symbol"><Icon name="file" size={24} /></span><div><p>{body}</p><small>Pièce jointe chiffrée</small></div></div> : <p>{readable ? body : event.isDecryptionFailure() ? 'Ce message ne peut pas être déchiffré sur cet appareil. Ses clés ne sont pas disponibles.' : 'Déchiffrement du message en cours…'}</p>}
                  {readable && event.getContent().msgtype === 'm.file' && event.getContent().file && <button className="file-download" disabled={!!downloading} onClick={() => void download(event)}>{downloading === event.getId() ? 'Déchiffrement…' : 'Télécharger et déchiffrer'} <Icon name="arrow" size={15} /></button>}
                  <small className="message-time">{new Date(event.getTs()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{event.status ? ` · ${{ encrypting: 'Chiffrement…', sending: 'Envoi…', queued: 'En attente', not_sent: 'Non envoyé', sent: 'Envoyé', cancelled: 'Annulé' }[event.status] || 'En cours'}` : ''}</small>
                </article>;
              })}
            </div>
            <div className="compose-area"><form className="composer" onSubmit={(event) => void send(event)}>
              <label className="sr-only" htmlFor="message">Message</label><textarea id="message" placeholder="Écrivez votre message…" maxLength={8000} rows={2} required value={text} onChange={(event) => setText(event.target.value)} disabled={working || !encrypted || !synced} />
              <div className="composer-tools"><div className="attachment-picker"><label htmlFor="attachment" title="Joindre un fichier · 5 Mo maximum"><Icon name="clip" /><span>Joindre</span></label>
              <input id="attachment" aria-label="Pièce jointe · 5 Mo maximum" type="file" disabled={working || !encrypted || !synced} onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null; event.target.value = '';
                if (chosen && chosen.size > MAX_FILE_SIZE) { setProblem('Fichier limité à 5 Mo.'); setFile(null); }
                else { setFile(chosen); setProblem(''); }
              }} />
              </div><span className="compose-limit">5 Mo maximum</span><button disabled={working || !encrypted || !synced || !text.trim()}>{working ? 'Envoi…' : 'Envoyer'}<Icon name="arrow" size={17} /></button></div>
            </form>
              {file && <div className="selected-file"><Icon name="file" /><span>{file.name}<small>{Math.ceil(file.size / 1024)} Ko</small></span><button className="icon-button" aria-label="Retirer la pièce jointe" disabled={working} onClick={() => setFile(null)}><Icon name="close" size={16} /></button><button className="secondary" disabled={working || !encrypted || !synced} onClick={() => void attach()}>{working ? 'Envoi…' : 'Chiffrer et envoyer le fichier'}</button></div>}
              <p className="compose-caption"><Icon name="lock" size={12} />{encrypted ? 'Chiffré sur votre appareil avant l’envoi.' : 'Envoi indisponible : chiffrement non confirmé.'}</p>
            </div>
          </>}
      </section>
      {details && room && !newRoom && <aside className="conversation-details" aria-label="Informations de la conversation"><div className="details-title"><h2>La conversation</h2><button className="icon-button" onClick={() => setDetails(false)} aria-label="Fermer les informations"><Icon name="close" size={18} /></button></div><span className="avatar detail-avatar">{room.name.slice(0, 2).toUpperCase()}</span><h3>{room.name}</h3><p className="details-subtitle">{room.getJoinedMemberCount()} participant(s)</p><div className="detail-security"><Icon name="lock" size={18} /><strong>{encrypted ? 'Chiffrement activé' : 'Chiffrement non confirmé'}</strong><p>Les appareils des participants ne sont pas encore vérifiés.</p></div><h4><Icon name="users" size={17} /> Participants</h4><div className="member-list">{room.getJoinedMembers().map((member) => <div className="member" key={member.userId}><span className="avatar small">{member.name.slice(0, 2).toUpperCase()}</span><div><strong>{member.userId === connection.userId ? `${member.name} (vous)` : member.name}</strong><small>{member.userId}</small></div></div>)}</div><p className="details-footnote">Le serveur connaît le nom du groupe et la liste des membres. Évitez les informations confidentielles dans le nom.</p></aside>}
    </main>}
    </div>
  </div>;
}
