# Fichiers chiffrés

`client/src/attachments.ts` utilise matrix-encrypt-attachment 1.0.3 (Apache-2.0).
La bibliothèque implémente le format Matrix v2 avec AES-CTR et empreinte SHA-256.
Aucun algorithme propre au projet. Source :
https://github.com/matrix-org/matrix-encrypt-attachment

Le client vérifie le chiffrement du salon, chiffre le fichier dans le navigateur,
puis téléverse uniquement ces octets avec type application/octet-stream et sans
nom de fichier. La clé, le nom réel et les métadonnées du fichier sont placés dans
un message de salon que matrix-js-sdk chiffre avec Megolm. Limite : 5 Mo.

Téléchargement authentifié sur le serveur local uniquement. La bibliothèque
contrôle l'empreinte et déchiffre avant téléchargement en application/octet-stream,
sans prévisualisation HTML. Le nom est nettoyé des séparateurs de chemin et
caractères de contrôle. Taille et horaires restent observables par le serveur.
Un fichier téléversé puis non envoyé peut rester orphelin, mais chiffré.
Le filtre Synapse ne garantit pas le chiffrement des téléversements faits par
un autre client ; la protection de ce flux dépend de notre client.

Validation : trois tests sur notre orchestration, dont refus d'un salon sans
chiffrement, refus d'un fichier trop grand et transmission du chiffré avec les
bonnes informations de déchiffrement. Bibliothèque cryptographique non modifiée.
Test réel : envoi navigateur A dans le groupe, réception et téléchargement B,
fichier reçu identique octet pour octet au fichier fictif initial (100 octets).
Inspection directe des fichiers du volume Synapse non effectuée.
