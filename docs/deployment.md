# Déploiement local du prototype

## Installation neuve

Prérequis : Docker/Compose Linux et Node.js 24 sur le poste de préparation.
Depuis la racine :

```powershell
node docker/prepare.mjs
docker compose up -d --wait --wait-timeout 120 synapse
node server/admin-bootstrap.mjs
docker compose up -d --build --wait --wait-timeout 180
```

La première commande génère les secrets. La deuxième démarre PostgreSQL et
Synapse, après préparation des droits de son volume. La troisième enrôle les
comptes et prépare le jeton technique : elle exige un Synapse accessible.
La quatrième construit le client et le service d'administration, puis attend
leur disponibilité. Après cette initialisation, `docker compose up -d` suffit.

Le client est sur http://127.0.0.1:8088. Le port 8080 du poste est occupé par
un autre logiciel, qui n'a pas été modifié. Synapse reste accessible directement
sur http://127.0.0.1:8008. Le service d'administration n'a aucun port publié.
Nginx transmet /_matrix à Synapse et /api au service d'administration.
Le frontend ne monte aucun dossier de secrets, uniquement son build.

## Projet existant

Ne pas relancer prepare.mjs : les secrets sont déjà créés. La migration de
politique a été appliquée localement. admin-bootstrap.mjs a aussi été exécuté.
Appliquer `docker compose up -d --build --wait --wait-timeout 180` pour ajouter
les conteneurs web et administration. Leur lancement complet reste à vérifier
dans la session utilisateur possédant Docker ; la syntaxe Compose est validée.

En cas d'échec : `docker compose ps`, puis
`docker compose logs --tail 60 web administration_api synapse`.
Ne pas partager .env, les configurations runtime ou les identités techniques.
Après lancement : `node server/check-deployment.mjs` vérifie la page, les proxies,
la politique de chargement du navigateur et l'absence d'accès aux chemins privés.

## Origines navigateur et clés

127.0.0.1:5173 (développement), 127.0.0.1:8088 (Docker) et localhost sont des
origines différentes. Leurs sessions et clés navigateur sont séparées. Une
connexion sur une nouvelle origine crée un nouvel appareil ; sans récupération
de clés, les anciens messages peuvent être indéchiffrables sur cet appareil.
Pour la démonstration finale, conserver une origine et créer une conversation
de test après y avoir connecté les deux agents.

## Données et reprise

`docker compose down` conserve les volumes. `down -v` efface les données : ne
pas l'utiliser pour résoudre un problème de démarrage. Sauvegarder en privé
les volumes PostgreSQL/Synapse et les configurations runtime, dont la clé de
signature serveur. Les clés E2EE du navigateur sont distinctes et n'ont pas
encore de sauvegarde/récupération intégrée. Aucune restauration complète testée.

Le secret Compose local est un montage de fichier, pas un coffre chiffré.
Sur Linux, donner la lecture du fichier de session technique au seul UID 1000
du conteneur Node et à l'administrateur local. Ne pas le rendre public.

Certaines images utilisent des canaux majeurs/mineurs et non des digests ; les
dépendances npm sont verrouillées. Les digests d'images restent à figer après
téléchargement vérifié. Pas de service propriétaire obligatoire à l'exécution.
Le téléchargement initial utilise des registres publics.

## Sortie du poste local

Configuration HTTP de développement seulement. Avant un accès depuis un autre
poste : domaine définitif, HTTPS, origines autorisées, politique réseau,
gestion des identités/MFA, vérification d'appareils, sauvegarde des clés,
tests de charge et revue indépendante. Le nom Matrix du serveur ne doit pas
être changé après la création des identités. Le prototype reste destiné aux
données fictives.
