import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MatrixClient } from 'matrix-js-sdk';
import { decryptAttachment } from 'matrix-encrypt-attachment';
import { MAX_FILE_SIZE, sendEncryptedFile } from '../src/attachments.ts';

test('salon non chiffré : aucun téléversement', async () => {
  let uploaded = false;
  const client = { getCrypto: () => ({ isEncryptionEnabledInRoom: async () => false }),
    uploadContent: async () => { uploaded = true; } } as unknown as MatrixClient;
  await assert.rejects(sendEncryptedFile(client, '!room:test', new File(['test'], 'test.txt')));
  assert.equal(uploaded, false);
});

test('fichier trop volumineux : rejet avant accès au serveur', async () => {
  const client = {} as MatrixClient;
  const file = new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'trop-grand.bin');
  await assert.rejects(sendEncryptedFile(client, '!room:test', file), /5 Mo/);
});

test('le téléversement reçoit le chiffré et le message reçoit la clé', async () => {
  const original = new File(['TEST-FICHIER-226 : contenu fictif'], 'document-fictif.txt', { type: 'text/plain' });
  let uploaded: ArrayBuffer | undefined;
  let message: Record<string, any> | undefined;
  const client = {
    getCrypto: () => ({ isEncryptionEnabledInRoom: async () => true }),
    uploadContent: async (blob: Blob, options: { includeFilename: boolean; type: string }) => {
      assert.equal(options.includeFilename, false);
      assert.equal(options.type, 'application/octet-stream');
      uploaded = await blob.arrayBuffer();
      assert.ok(!new TextDecoder().decode(uploaded).includes('TEST-FICHIER-226'));
      return { content_uri: 'mxc://messagerie226.local/fixture' };
    },
    sendMessage: async (_room: string, content: Record<string, any>) => { message = content; },
  } as unknown as MatrixClient;
  await sendEncryptedFile(client, '!room:test', original);
  assert.ok(uploaded && message);
  assert.equal(message.msgtype, 'm.file');
  assert.equal(message.body, original.name);
  assert.equal(message.url, undefined);
  assert.equal(message.file.url, 'mxc://messagerie226.local/fixture');
  // Vérifie que notre orchestration transmet la bonne clé avec les bonnes données.
  const restored = await decryptAttachment(uploaded, message.file);
  assert.deepEqual(new Uint8Array(restored), new Uint8Array(await original.arrayBuffer()));
});
