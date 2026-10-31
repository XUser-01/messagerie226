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
