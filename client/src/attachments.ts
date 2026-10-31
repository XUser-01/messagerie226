import { decryptAttachment, encryptAttachment, type IEncryptedFile } from 'matrix-encrypt-attachment';
import { MsgType, type MatrixClient } from 'matrix-js-sdk';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function sendEncryptedFile(client: MatrixClient, roomId: string, file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error('Fichier limité à 5 Mo pour ce prototype.');
  if (!await client.getCrypto()?.isEncryptionEnabledInRoom(roomId)) throw new Error('Salon non chiffré.');
  const encrypted = await encryptAttachment(await file.arrayBuffer());
  if (!encrypted.info.hashes?.sha256 || encrypted.info.v !== 'v2') throw new Error('Format chiffré inattendu.');
  // Le nom et le type réels ne doivent pas accompagner le fichier chiffré côté médias.
  const upload = await client.uploadContent(new Blob([encrypted.data], { type: 'application/octet-stream' }),
    { includeFilename: false, type: 'application/octet-stream' });
  await client.sendMessage(roomId, {
    msgtype: MsgType.File, body: file.name,
    file: { ...encrypted.info, url: upload.content_uri, v: 'v2', hashes: { sha256: encrypted.info.hashes.sha256 } },
    info: { size: file.size, mimetype: file.type || 'application/octet-stream' },
  });
}

export async function downloadEncryptedFile(client: MatrixClient, descriptor: IEncryptedFile & { url: string }, name: string) {
  if (!/^mxc:\/\/messagerie226\.local\/[a-zA-Z0-9_-]+$/.test(descriptor.url) || descriptor.v !== 'v2'
    || !descriptor.hashes?.sha256) throw new Error('Pièce jointe non reconnue.');
  const url = client.mxcUrlToHttp(descriptor.url, undefined, undefined, undefined, false, false, true);
  if (!url || new URL(url).origin !== window.location.origin) throw new Error('Serveur de fichiers non autorisé.');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${client.getAccessToken()}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Téléchargement refusé.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_SIZE) throw new Error('Pièce jointe trop volumineuse.');
  // La bibliothèque vérifie l'empreinte du fichier chiffré avant de déchiffrer.
  const plaintext = await decryptAttachment(bytes, descriptor);
  const objectUrl = URL.createObjectURL(new Blob([plaintext], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = objectUrl; link.download = name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 150) || 'piece-jointe';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}
