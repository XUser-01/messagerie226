# Sécurité : enrôlement, rôles, révocation

Périmètre : contrôle d'accès du prototype. Le chiffrement des messages est
fourni par Matrix (E2EE, matrix-js-sdk et Rust Crypto). L'équipe n'a défini
aucun algorithme cryptographique. Données fictives uniquement.

## 1. Enrôlement
- Seuls les comptes créés par le serveur peuvent se connecter ; l'inscription
  publique est refusée (testé par `server/check-enrollment.mjs`).
- Le script `server/enroll-demo.mjs` crée les agents sans droits administrateur,
  par l'API officielle shared-secret de Synapse (nonce à usage unique, HMAC).
- Un compte non enrôlé est refusé (testé).

## 2. Authentification
- Connexion Matrix auprès de Synapse ; le mot de passe n'est pas conservé.
- Le jeton est vérifié par whoami avant tout démarrage du moteur de chiffrement.
- La déconnexion invalide d'abord le jeton côté serveur ; sans confirmation du
  serveur, l'interface signale l'échec.
- Synapse limite les tentatives de connexion par IP et par compte.

## 3. Rôles
- Deux niveaux : AGENT (compte Matrix ordinaire) et gestionnaire (rôle
  applicatif attribué uniquement dans `server/admin-policy.mjs`).
- Le navigateur ne peut pas choisir son rôle : un rôle falsifié donne 403.
- Le compte technique `service.admin` n'est jamais exposé au client. Son jeton
  n'est lu que par `server/admin-api.mjs`.
- L'API d'administration expose seulement : identité courante, liste des
  comptes autorisés, révocation. Pas de proxy générique vers Synapse.
- Le gestionnaire et les comptes techniques ne peuvent pas être révoqués.

## 4. Révocation
1. Le gestionnaire demande la révocation (jeton Bearer obligatoire).
2. Le serveur vérifie le jeton (whoami) puis le rôle.
3. Le serveur désactive le compte via l'API d'administration de Synapse
   (`deactivate`, erase=false) et vérifie `deactivated=true`.
4. Synapse invalide les jetons et organise la sortie du compte des salons.
5. L'ancien jeton, la synchronisation, l'historique et un nouveau login sont
   refusés (testé par `server/check-revocation.mjs`).
6. Le client vérifie son identité toutes les 5 secondes : un jeton invalidé
   ferme l'écran, arrête le moteur et efface le jeton de sessionStorage.
Temps de réponse de la révocation mesuré : 227 ms (requêtes en cours non mesurées).

## 5. Menaces prises en compte
- Compte inconnu ou non enrôlé : refusé.
- Agent révoqué en cours d'usage : accès refusé côté serveur.
- Agent qui tente une action d'administration : 401 sans jeton, 403 pour un
  agent ou un rôle falsifié.
- Appels depuis un autre site : requêtes cross-origin refusées.
- Fuite de secrets : fichiers de secrets hors Git, jeton technique jamais
  envoyé au client, secrets refusés en HTTP 403 par Vite.
- Surface d'administration minimale (3 opérations).

## 6. Limites connues
- Pas d'authentification multifacteur.
- Pas de vérification croisée d'appareils ni de récupération des clés.
- Un agent révoqué garde les copies et clés déjà reçues ; une requête en cours
  peut avoir reçu des données avant la révocation. La fermeture d'écran n'est
  pas une suppression à distance.
- Côté client, la détection peut prendre jusqu'à 5 secondes ; aucune garantie
  d'instantanéité absolue.
- Pas de réactivation ordinaire d'un compte révoqué : il faut un nouveau mot de
  passe et de nouvelles invitations.
- Jeton en sessionStorage et clés en IndexedDB : exposés en cas de XSS, de
  profil navigateur ou d'appareil compromis. Aucune protection contre un
  administrateur local malveillant n'est revendiquée.
- Mots de passe de démonstration en clair dans `server/runtime/demo-accounts.json`
  (hors Git, données fictives, protection par les permissions du système).
- HTTP limité au PC de développement ; HTTPS requis ailleurs.
- L'enrôlement se fait par script ; l'API d'administration n'expose pas de
  création de compte ni d'attribution de rôle. [À CONFIRMER avec l'équipe]
- Un moteur de chiffrement initialisé n'est pas une preuve qu'un message a été
  chiffré.

## 7. Messages et métadonnées
- Un filtre côté serveur (`server/modules/no_plaintext.py`, callback officiel
  de Synapse) n'autorise que les messages chiffrés `m.room.encrypted` avec une
  enveloppe Megolm structurée. Le texte clair, les stickers et les types
  personnalisés sont refusés (HTTP 403, testé par
  `server/check-message-policy.mjs`).
- Le serveur ne détient pas les clés de déchiffrement des messages.
- Les métadonnées d'état restent visibles du serveur : membres des salons,
  droits, nom, etc. Elles peuvent aussi être détournées.
- Limites : le filtre vérifie la forme de l'enveloppe, pas sa validité
  cryptographique ; il n'inspecte pas les téléversements de fichiers (leur
  chiffrement doit être fait et testé côté client) ; il ne prouve pas
  l'absence de tout canal de texte. Déploiement local sans fédération.



## 8. Déploiement et exposition
- Déploiement local avec Docker Compose : PostgreSQL, Synapse, le client web
  (nginx) et le service d'administration. Le client est sur
  `http://127.0.0.1:8088`, Synapse sur `http://127.0.0.1:8008`.
- Le service d'administration n'a aucun port publié : nginx transmet `/api`
  vers lui et `/_matrix` vers Synapse. Le frontend ne monte aucun dossier de
  secrets, seulement son build.
- `server/check-deployment.mjs` vérifie la page, les proxies, la politique de
  chargement du navigateur et l'absence d'accès aux chemins privés.
- Aucun service propriétaire n'est requis à l'exécution ; les dépendances npm
  sont verrouillées.

### Limites du déploiement
- HTTP de développement seulement. Avant tout accès depuis un autre poste :
  domaine définitif, HTTPS, origines autorisées, politique réseau, gestion des
  identités et MFA, vérification d'appareils, sauvegarde des clés, tests de
  charge et revue indépendante.
- Le secret Compose est un fichier monté, pas un coffre chiffré.
- Les clés E2EE du navigateur n'ont pas de sauvegarde ni de récupération
  intégrée : sur une nouvelle origine ou un nouvel appareil, les anciens
  messages peuvent être indéchiffrables.
- Aucune restauration complète n'a été testée. `docker compose down -v` efface
  les données.
- Les images Docker utilisent des canaux majeurs/mineurs, pas des digests.
- Le nom Matrix du serveur ne doit pas être changé après la création des
  identités. Le prototype est destiné aux données fictives et sans fédération.

## 9. À confirmer
- [À CONFIRMER] Si les horodatages et les participants d'un salon sont
  visibles du serveur (non précisé dans `docs/message-policy.md`).
