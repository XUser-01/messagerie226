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
