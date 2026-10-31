# Messagerie226 — prototype pédagogique

Messagerie auto-hébergée pour des agents fictifs de l'administration burkinabè.
Objectif : conversations privées, groupes et fichiers chiffrés, enrôlement contrôlé
et révocation. Aucun agrément officiel ni valeur juridique revendiqués.

**État : serveur validé le 31 octobre 2026 dans la session utilisateur : PostgreSQL
et Synapse healthy, API Matrix `/versions` accessible. Chiffrement et révocation
non encore validés. Client en construction.**

## Architecture

Navigateur React → API Matrix Synapse → PostgreSQL et stockage local des médias.
Le navigateur devra chiffrer avant l'envoi avec matrix-js-sdk / Rust Crypto.
Voir [les choix et limites](docs/architecture.md).

## Technologies open source

| Composant | Rôle | Licence et source officielle |
|---|---|---|
| Synapse 1.164.1 | Serveur Matrix | [AGPL-3.0](https://github.com/element-hq/synapse/blob/develop/LICENSE-AGPL-3.0) |
| PostgreSQL 17 | Base de données | [PostgreSQL License](https://www.postgresql.org/about/licence/) |
| React (prévu) | Client personnalisé | [MIT](https://github.com/facebook/react/blob/main/LICENSE) |
| matrix-js-sdk 45.0.0 | API Matrix et intégration crypto | [Apache-2.0](https://github.com/matrix-org/matrix-js-sdk/blob/develop/LICENSE) |
| Matrix Rust SDK (prévu) | Moteur E2EE | [Apache-2.0](https://github.com/matrix-org/matrix-rust-sdk/blob/main/LICENSE) |
| Docker Engine / Compose | Conteneurs sur Linux | [Apache-2.0 Engine](https://github.com/moby/moby/blob/master/LICENSE), [Compose](https://github.com/docker/compose/blob/main/LICENSE) |

Notre code : MIT, voir LICENSE. Ces licences ne remplacent pas celles des dépendances.
Docker Desktop est un outil de développement Windows distinct, soumis à ses propres
conditions ; il n'est pas une dépendance du déploiement Linux final.

## Installation locale prévue

Prérequis : Node.js 24, Docker avec Compose et conteneurs Linux.
Depuis ce dossier :

```powershell
node docker/prepare.mjs
docker compose config --quiet
docker compose up -d
docker compose ps
Invoke-RestMethod http://localhost:8008/_matrix/client/versions
```

La préparation crée `.env` et `docker/runtime/homeserver.yaml`, jamais versionnés.
Elle refuse d'écraser une configuration existante. Ne pas copier manuellement
`.env.example` avant cette commande. Les services doivent être sains et l'API doit
retourner `versions`. Cela prouve la disponibilité, pas le chiffrement.

Pour arrêter sans effacer les données : `docker compose down`.
Ne pas utiliser `down -v` : cela détruirait les volumes.

### Premier écran web

Depuis `client/` : `npm ci`, `npm run build`, puis `npm run dev`.
Ouvrir http://127.0.0.1:5173 pour vérifier la connexion du navigateur à Synapse.
Le formulaire permet la connexion des agents et initialise Rust Crypto.
L'envoi de messages reste à intégrer et à vérifier.

## Comptes de démonstration

`node server/enroll-demo.mjs` crée les comptes fictifs `agent.a` et `agent.b`,
sans droits administrateur. Leurs mots de passe aléatoires restent dans
`server/runtime/demo-accounts.json`, exclu de Git. Ne pas publier ce fichier.
Inscription publique interdite. Voir [authentification et limites](docs/authentication.md).
Tests serveur : `node server/check-enrollment.mjs`.

## Sécurité et limites

Configuration limitée à ce PC, HTTP local uniquement. HTTPS obligatoire avant
accès depuis un autre appareil. Aucun message réel ni donnée personnelle.
E2EE, authentification forte, contrôle des événements en clair, fichiers chiffrés,
révocation et sauvegarde des clés **non encore implémentés ou validés**.
Le serveur connaît certaines métadonnées. Révoquer ne peut pas effacer une copie
déjà reçue. Pas de service tiers obligatoire prévu à l'exécution ; les images
et dépendances nécessitent un téléchargement initial.

## Sprint de 30 heures — budget cible, pas garantie

0–4 h : environnement et serveur ; 4–10 h : login et E2EE ; 10–16 h :
messages, groupes et fichiers ; 16–22 h : enrôlement et révocation ;
22–26 h : scénarios de sécurité ; 26–30 h : stabilisation et démonstration.
P1 uniquement après P0 vérifié ; aucune tâche P2 engagée.

## Équipe

À compléter par les participants. Nom du produit provisoire.
