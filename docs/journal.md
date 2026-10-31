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
