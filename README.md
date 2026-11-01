# Messagerie226 — prototype pédagogique

Messagerie auto-hébergée pour des agents fictifs de l'administration burkinabè.
Objectif : conversations privées, groupes et fichiers chiffrés, enrôlement contrôlé
et révocation. Aucun agrément officiel ni valeur juridique revendiqués.

**État au 1 novembre 2026 : serveur, login, texte E2EE, groupe et fichier chiffré
testés localement. Révocation validée par API et dans le navigateur. Les quatre
services Docker sont sains ; connexion, échanges E2EE, fichier et reprise de
session vérifiés sur http://127.0.0.1:8088. Prototype,
sans authentification forte ni récupération des clés, à ne pas utiliser en réel.**

## Architecture

Navigateur React → API Matrix Synapse → PostgreSQL et stockage local des médias.
Le navigateur chiffre avant l'envoi avec matrix-js-sdk / Rust Crypto. Le service
d'administration Node vérifie les rôles et conserve ses droits Synapse côté serveur.
Voir [les choix et limites](docs/architecture.md).

## Technologies open source

| Composant | Rôle | Licence et source officielle |
|---|---|---|
| Synapse 1.164.1 | Serveur Matrix | [AGPL-3.0](https://github.com/element-hq/synapse/blob/develop/LICENSE-AGPL-3.0) |
| PostgreSQL 17 | Base de données | [PostgreSQL License](https://www.postgresql.org/about/licence/) |
| React 19.3.1 | Client personnalisé | [MIT](https://github.com/facebook/react/blob/main/LICENSE) |
| matrix-js-sdk 45.0.0 | API Matrix et intégration crypto | [Apache-2.0](https://github.com/matrix-org/matrix-js-sdk/blob/develop/LICENSE) |
| Matrix Rust Crypto (WASM 18.9.0) | Moteur E2EE | [Apache-2.0](https://github.com/matrix-org/matrix-rust-sdk/blob/main/LICENSE) |
| matrix-encrypt-attachment 1.0.3 | Pièces jointes chiffrées côté client | [Apache-2.0](https://github.com/matrix-org/matrix-encrypt-attachment/blob/master/LICENSE) |
| Docker Engine / Compose | Conteneurs sur Linux | [Apache-2.0 Engine](https://github.com/moby/moby/blob/master/LICENSE), [Compose](https://github.com/docker/compose/blob/main/LICENSE) |
| Node.js 24 | Outils et service d'administration | [MIT et licences des composants](https://github.com/nodejs/node/blob/main/LICENSE) |
| Nginx 1.30.6 | Client web et routage des API | [BSD à deux clauses](https://nginx.org/LICENSE) |

Notre code : MIT, voir LICENSE. Ces licences ne remplacent pas celles des dépendances.
Docker Desktop est un outil de développement Windows distinct, soumis à ses propres
conditions ; il n'est pas une dépendance du déploiement Linux final.

## Installation locale

Prérequis : Node.js 24, Docker avec Compose et conteneurs Linux.
Depuis ce dossier :

```powershell
node docker/prepare.mjs
docker compose up -d --wait --wait-timeout 120 synapse
node server/admin-bootstrap.mjs
docker compose up -d --build --wait --wait-timeout 180
```

Ouvrir http://127.0.0.1:8088. La première préparation crée `.env` et
`docker/runtime/homeserver.yaml`, jamais versionnés.
Elle refuse d'écraser une configuration existante. Ne pas copier manuellement
`.env.example` avant cette commande. Pour ce projet déjà préparé, exécuter
seulement la dernière commande. Voir [déploiement et reprise](docs/deployment.md).

Sur ce poste, utiliser le moteur séparé déjà créé pour reconstruire :
`docker compose build --builder messagerie226-build web administration_api`,
puis `docker compose up -d --no-build --wait --wait-timeout 180`.
Pour démarrer les images existantes, seule cette dernière commande est requise.

Pour arrêter sans effacer les données : `docker compose down`.
Ne pas utiliser `down -v` : cela détruirait les volumes.

### Développement hors conteneur du client

Depuis la racine : `node server/admin-api.mjs`. Dans un autre terminal, depuis
`client/` : `npm ci`, `npm run build`, puis `npm run dev`.
Ouvrir http://127.0.0.1:5173.
Le formulaire connecte les agents et initialise Rust Crypto. Discussions privées,
groupes nommés, invitations, texte et pièces jointes chiffrées sont disponibles.
Tests client : `npm test`. Utiliser uniquement des données fictives.

## Comptes de démonstration

`node server/admin-bootstrap.mjs` prépare `agent.a`, `agent.b`, `agent.test` et
`gestionnaire.demo` (gestionnaire de l'application, compte Matrix ordinaire).
`service.admin` est technique, réservé au backend. Les mots de passe de démonstration restent dans
`server/runtime/demo-accounts.json`, exclu de Git. Ne pas publier ce fichier.
Inscription publique interdite. Voir [authentification et limites](docs/authentication.md).
Tests serveur : `node server/check-enrollment.mjs`, `node server/check-message-policy.mjs`,
`node server/check-encrypted-events.mjs`, `node server/check-revocation.mjs`.
Les limites Synapse peuvent imposer plusieurs minutes entre les tests de login.

## Sécurité et limites

Configuration limitée à ce PC, HTTP local uniquement. HTTPS obligatoire avant
accès depuis un autre appareil. Aucun message réel ni donnée personnelle.
Messages en clair refusés par un module Synapse ; échanges E2EE et pièce jointe
testés dans deux clients. La révocation invalide les jetons ; la fermeture de
l'écran connecté est détectée par sync ou contrôle toutes les cinq secondes.
MFA, vérification mutuelle des appareils, récupération des clés et déploiement
sur un réseau réel ne sont pas encore validés. Le stockage navigateur demeure
exposé à une compromission de l'appareil ou du code de la même origine.
Le serveur connaît certaines métadonnées. Révoquer ne peut pas effacer une copie
déjà reçue. Pas de service tiers obligatoire prévu à l'exécution ; les images
et dépendances nécessitent un téléchargement initial.
Voir [politique de messages](docs/message-policy.md), [fichiers](docs/attachments.md)
et [révocation](docs/revocation.md). Aucune fonction P1 engagée avant validation P0.

## Sprint de 30 heures — budget cible, pas garantie

0–4 h : environnement et serveur ; 4–10 h : login et E2EE ; 10–16 h :
messages, groupes et fichiers ; 16–22 h : enrôlement et révocation ;
22–26 h : scénarios de sécurité ; 26–30 h : stabilisation et démonstration.
P1 uniquement après P0 vérifié ; aucune tâche P2 engagée.


## Équipe

### OUEDRAOGO Emmanuel Seguerim
- Architecture générale
- Intégration Matrix / Synapse
- Client React et UI/UX
- Docker et déploiement
- Intégration E2EE
- Messagerie, groupes et fichiers
- Documentation générale et démonstration

### Moumouni Sana
- Sécurité et contrôle d'accès
- Enrôlement des agents
- Gestion des rôles
- Révocation des utilisateurs
- Tests de sécurité
- Documentation sécurité

