# Journal pédagogique

## Étape 1 — dépôt

Création du README, licence MIT, architecture et dossiers client/serveur.
Commandes : `git init -b main`, `git add`, `git diff --cached --check`, `git commit`.
Résultat : structure versionnée, pas encore d'application utilisable.

## Étape 2 — configuration Docker

Compose lance PostgreSQL puis Synapse lorsque la base répond. Les volumes
préservent les données à l'arrêt. Le script `node docker/prepare.mjs` crée les
secrets locaux et refuse une seconde exécution pour ne pas casser la base.
Le secret d'enrôlement permet une future création de comptes depuis un outil
administrateur : il doit rester côté serveur. Ce n'est pas un mot de passe agent.

Vérifications locales : syntaxe Node, génération, refus d'écrasement,
cohérence du mot de passe sans affichage, exclusion Git des secrets, diff propre.
Validation Docker et fonctionnement serveur : en attente de Docker installé.
Le téléchargement de l'image et sa validation restent à faire.

## Étape 3 — premier démarrage et accès local

Résultat transmis par l'utilisateur : les deux images sont téléchargées,
PostgreSQL est healthy, Synapse démarre. L'API locale refuse la connexion et
`compose ps` ne montre pas le port hôte : Synapse était uniquement raccordé
au réseau interne. Ajout d'un réseau bridge `client_access` pour Synapse seul.
PostgreSQL reste interne. Conséquence : Synapse peut désormais sortir sur le
réseau ; la désactivation de fédération est applicative, pas un blocage réseau.

Validation statique : `docker compose config --quiet`. Validation réelle à faire
dans la session utilisateur : `docker compose up -d`, `docker compose ps`, puis
`Invoke-RestMethod http://localhost:8008/_matrix/client/versions`.

## Étape 4 — droits du volume Synapse

Journaux fournis : PermissionError sur `/data/messagerie226.local.signing.key`.
Synapse ne termine pas son démarrage. L'image abandonne les droits root pour
991:991 mais, en mode run, ne prépare pas la propriété du volume neuf.
Ajout de `synapse_data_init` : même image, commande `chown 991:991 /data`, sans
réseau, exécution ponctuelle en root. Aucun changement récursif ni suppression.
Synapse attend sa réussite avant de démarrer. La clé est créée par Synapse et
reste dans le volume ; elle signe l'identité serveur, ce n'est pas une clé E2EE.

Source vérifiée : https://github.com/element-hq/synapse/blob/v1.164.1/docker/start.py
Validation statique : Compose. Test réel restant dans la session utilisateur :
`docker compose up -d --wait --wait-timeout 120`, puis API versions.

Résultat transmis le 31 octobre 2026 : Synapse et PostgreSQL healthy,
initialisation Exited avec succès et réponse `versions` de l'API Matrix.
Les erreurs de droits conservées dans l'extrait précèdent cette réussite.
La disponibilité du serveur est validée ; ce résultat ne prouve pas l'E2EE.

## Étape 5 — premier client React

Fichiers : `client/package.json`, verrou npm, configuration TypeScript/Vite,
`client/src/App.tsx`, `main.tsx`, styles et déclaration des types Vite.
React affiche les états vérification/succès/échec. `fetch` interroge l'API via
le proxy local Vite ; délai maximal de huit secondes et bouton de nouvelle
tentative. Les versions Matrix reçues doivent être une liste non vide de textes.
Aucune authentification, session ni fonction d'envoi n'est encore ajoutée.

Commandes exécutées : `npm install`, `npm run build`, `npm run dev`.
La première compilation signalait les types CSS manquants ; ajout de
`vite-env.d.ts`, puis compilation réussie. Test navigateur réel : état
« Serveur Matrix accessible », bouton de vérification essayé, capture visuelle
en vue étroite. Le scénario serveur arrêté n'a pas été exécuté.
Le port de développement est 127.0.0.1:5173 et le proxy cible 127.0.0.1:8008.

## Étape 6 — référence UI/UX

Lecture de la référence HTML fournie, y compris ses écrans intégrés. Les choix
et adaptations sont consignés dans `docs/reference-interface.md`. Aucun code
de la référence exécuté ou intégré au client. Vérification : diff documentaire.
Pas de changement du comportement applicatif ni de validation de sécurité.

## Étape 7 — enrôlement

Ajout de scripts d'enrôlement et de contrôle des comptes fictifs, selon l'API
Synapse officielle. `node server/enroll-demo.mjs` exécuté deux fois : création,
puis conservation des comptes existants. `git check-ignore` confirme l'exclusion
des mots de passe. `node server/check-enrollment.mjs` : tous les contrôles passent
sur le serveur local, dont refus admin, inscription publique et jeton invalidé.
Mécanismes et limites dans `docs/authentication.md`.

## Étape 8 — login et moteur cryptographique navigateur

matrix-js-sdk 45.0.0 installé et verrouillé, audit npm sans vulnérabilité connue
au moment de l'installation. `npm run build` passe. Le bundle Rust WASM ajoute
environ 7,8 Mo non compressés : optimisation faible connexion non encore faite.
Test navigateur : agent A connecté, Rust Crypto initialisé ; rechargement avec
même identifiant d'appareil ; déconnexion ; compte inexistant refusé avec une
erreur lisible. Aucun message chiffré échangé pendant cette étape.

L'agent B réussit les tests HTTP mais le test navigateur a rencontré la
limitation de tentatives Synapse. Elle n'a pas été désactivée. Validation du
moteur Rust et de la reprise navigateur obtenue avec A uniquement.

## Étape 9 — politique serveur avant les messages

Module no_plaintext via le callback spam checker officiel, sans cryptographie
maison. Six tests unitaires de politique passent. Compose validé statiquement.
Migration ciblée de la configuration locale exécutée avec sauvegarde hors Git.
Module non encore activé dans le processus Synapse courant : la session
utilisateur doit appliquer `docker compose up -d --wait --wait-timeout 120`.
Les limites sont explicites dans `docs/message-policy.md` : métadonnées,
enveloppes non vérifiables sans clés et téléversements de fichiers hors filtre.

## Étape 10 — politique active, messages et groupe

Après activation utilisateur : API HTTP 200. `node server/check-message-policy.mjs`
passe sur le serveur réel : création de salon autorisée et événements de texte
clair/custom refusés en HTTP 403, puis fermeture de la session de test.

Client : Workspace.tsx ajoute salons privés, invitations explicites, groupe nommé,
historique et texte. Avant chaque envoi, le moteur Rust doit confirmer le
chiffrement du salon ; le SDK chiffre l'événement. Pas de repli en clair.
Le mode de confiance par défaut du SDK est conservé : appareils non vérifiés,
avertissement visible. Vérification croisée des identités toujours à faire.

`npm run build` passe après correction du nom d'enum RoomMessageEncrypted.
Test réel avec deux onglets et appareils distincts A/B : création privée,
invitation acceptée, texte A vers B puis B vers A lisible après déchiffrement.
Rechargement de B : les deux messages sont encore déchiffrés grâce aux clés
IndexedDB. Groupe nommé créé et invitation acceptée, avec deux participants.
La création de groupes à plus de deux membres n'a pas encore été testée.
`node server/check-encrypted-events.mjs` inspecte les événements bruts Matrix :
deux enveloppes Megolm, sans body ni marqueur du message de test lisible.
Portée : API d'événements, 100 derniers événements par salon rejoint ; pas
d'inspection directe PostgreSQL ou de capture réseau à ce stade.

## Étape 11 — pièces jointes et reprise de session

matrix-encrypt-attachment 1.0.3 installé et figé. attachments.ts chiffre avant
téléversement et transmet sa clé dans le message E2EE. Trois tests client passent,
compilation réussie. Test navigateur : sélection du fichier fictif, envoi A dans
le groupe, téléchargement/déchiffrement B ; comparaison binaire via fs dans
l'outil de test navigateur : sameBytes=true, 100 octets.

Un rechargement automatique pendant le développement a révélé une course entre
libération de Web Lock et restauration. Le client attend maintenant au maximum
cinq secondes l'ancien verrou, sans autoriser deux écritures simultanées.
Les deux sessions ont repris après ce changement. Limites dans attachments.md.

## Étape 12 — contrôle d'administration et révocation

admin-bootstrap.mjs enrôle gestionnaire.demo et agent.test comme comptes Matrix
ordinaires, et prépare service.admin réservé au backend. admin-api.mjs vérifie
chaque session avec whoami et attribue les rôles depuis admin-policy.mjs. Les
droits Synapse ne passent jamais dans le navigateur. Le service d'administration
local a été lancé sur 127.0.0.1:3001 ; Vite transmet /api sans exposer les secrets.

check-revocation.mjs passe en conditions réelles : jeton absent/invalide refusé,
agent et rôle falsifié refusés, gestionnaire et compte technique protégés. Le
compte de test rejoint un salon puis est désactivé. Réponse observée en 227 ms ;
ancien token, sync, historique et nouveau login refusés. Le test ne mesure pas
les requêtes déjà en cours. A/B restent actifs.

AdminPanel.tsx affiche les statuts et une confirmation de révocation. App.tsx
retire une session invalidée via les erreurs sync ou un whoami toutes les 5 s.
Le gestionnaire voit le panneau et la liste ; les agents ordinaires n'ont pas
le bouton. Le scénario de révocation avec écran cible ouvert reste à finir.
Les limites Synapse ont été conservées ; le formulaire affiche le délai serveur.
Tests supplémentaires HTTP : origine étrangère 403, corps trop grand 413,
chemins privés via Vite 403. check-repository.mjs ne détecte aucun secret local
dans les sources. Compilation et trois tests client réussis.

## Étape 13 — scénario navigateur de révocation

Scénario réel exécuté le 31 octobre : A, B et agent.test ont rejoint un groupe
à trois membres. agent.test a déchiffré le message fictif avant révocation.
Le gestionnaire a révoqué agent.test depuis l'interface. Retour au formulaire
avec alerte de session invalidée observé en 725 ms dans ce test navigateur.
Le panneau confirme Révoqué ; A/B restent actifs. Ce résultat ponctuel ne prouve
pas une borne absolue ni le traitement de toutes les requêtes déjà en cours.

Le test a également révélé un compteur de membres non rafraîchi. Abonnement
ajouté à RoomStateEvent.Members et RoomEvent.Name ; compilation réussie et
état du groupe à trois membres confirmé après reprise de session.

## Étape 14 — livraison Docker et reprise du 1 novembre

Dockerfiles du client et du backend, Nginx 1.30.6 (image officielle vérifiée),
routage Matrix/API, secret réservé au backend et contrôles de santé préparés.
Compose validé. Lancement des nouveaux conteneurs encore à confirmer par
l'utilisateur, car le moteur Docker refuse l'accès au compte d'exécution agent.

Le port 8080 répond avec un serveur Apache d'un autre logiciel ; déplacement
du port hôte du client vers 8088, sans toucher à cet autre logiciel. Origines
autorisées et test de déploiement alignés. Synapse HTTP 200. Développement
relancé : Vite sur 5173 et administration sur 3001. Contrôle de 48 fichiers de
source sans secret détecté et six tests Python réussis. Tests Docker web réels
sur 8088 et revue finale navigateur attendent le lancement utilisateur.

Reprise après saturation du disque : environ 4,7 Go disponibles. Compilation
de production réussie (TypeScript puis Vite), trois tests de pièces jointes
et six tests Python réussis. Contrôle des sources : aucun secret local détecté.
Le lancement Docker complet reste distinct de ces validations de code.

Le build Docker utilisateur atteint la copie finale mais /app/dist manque,
malgré une étape npm déclarée réussie. Cause non déterminée avec ce journal.
Dockerfile renforcé : dépendances de développement explicites, présence des
outils et du HTML compilé contrôlée. Reconstruction sans cache et journal
complet demandés ; aucun conteneur web déclaré validé à ce stade.

Construction web réussie avec le builder dédié messagerie226-build, créé
avec le pilote docker-container et default-load=true. Le journal utilisateur
confirme Node 24.22.2/npm 11.19.1, installation des 40 dépendances, compilation
des 275 modules et import de messagerie226-web dans Docker. Le moteur intégré
présentait des exécutions Node/npm sans effet ; cause interne non établie.
Le port 8088 ne répond pas encore : construction administration puis lancement
sans reconstruction et test HTTP restent nécessaires.

## Étape 15 — validation Docker complète sur 8088

Le journal utilisateur confirme les quatre services healthy (PostgreSQL,
Synapse, administration_api, web) et le service d'initialisation terminé.
check-deployment.mjs relancé indépendamment : page/santé, proxy Matrix,
API sans jeton 401 et chemins privés 404 validés.

Test navigateur réel sur 8088 : connexion agent.a et agent.b, nouveau groupe
Validation Docker 8088, invitation acceptée, compteur à deux participants.
Texte envoyé et déchiffré dans les deux sens. Fichier fictif chiffré envoyé par A,
téléchargé et déchiffré chez B : comparaison exacte des 100 octets réussie.
Après rechargement de B, session restaurée et deux messages toujours lisibles.
Connexion gestionnaire et liste des statuts via API Docker réussies : A/B actifs,
agent.test révoqué. Aucune nouvelle révocation effectuée dans ce dernier scénario.
Captures de preuve enregistrées dans outputs hors dépôt. Les limites MFA,
vérification d'appareils, récupération des clés et HTTPS distant restent ouvertes.
