# Enrôlement et connexion du prototype

## Enrôlement côté serveur

`node server/enroll-demo.mjs` crée agent.a et agent.b, sans droits administrateur.
Le secret est lu dans la configuration locale Synapse ; aucune copie dans le
client React. Le script suit l'API officielle shared-secret : nonce à usage
unique puis HMAC-SHA1 via `node:crypto`, conformément au protocole Synapse.
Il ne chiffre pas de message et ne définit aucun algorithme cryptographique.
Source : https://element-hq.github.io/synapse/latest/admin_api/register_api.html

Les mots de passe aléatoires sont dans `server/runtime/demo-accounts.json`,
exclu de Git. Ce fichier de démonstration est en clair sur le PC : accès limité
par les permissions Windows, données fictives uniquement. Les modes POSIX
0o600 ne remplacent pas les ACL Windows. Ne pas copier ce fichier sur le serveur
web. Une seconde exécution du script conserve les mots de passe existants.

## Connexion du client

`client/src/matrix.ts` utilise matrix-js-sdk 45.0.0. Le formulaire demande un
login Matrix à Synapse ; le mot de passe n'est pas persisté. Une nouvelle
instance SDK reçoit le jeton et l'identifiant d'appareil. L'ordre est :
validation whoami → verrou d'appareil déjà acquis → initRustCrypto avec stockage
IndexedDB séparé par utilisateur/appareil → démarrage de la synchronisation.
La Web Locks API empêche deux moteurs d'écrire simultanément le même magasin.

Le jeton est dans sessionStorage pour reprendre un rechargement de cet onglet.
Les clés Rust Crypto restent dans IndexedDB. Ces stockages sont accessibles
au code de la même origine : XSS, profil navigateur compromis ou appareil
compromis restent des risques. Aucune protection contre un administrateur local
malveillant n'est revendiquée. La déconnexion appelle d'abord le serveur pour
invalider le jeton ; sans confirmation serveur, l'interface signale l'échec.
Les anciens magasins de clés ne sont pas effacés automatiquement.

Pas de MFA, vérification croisée d'appareils ni récupération des clés à ce stade.
Le moteur initialisé n'est pas une preuve qu'un message a été chiffré.
HTTP est limité au PC de développement ; HTTPS requis hors localhost.

## Tests

`node server/check-enrollment.mjs` utilise de vraies requêtes Matrix : login
des deux agents, identité attendue, refus de l'API administrateur, logout,
refus du jeton invalidé, compte non enrôlé refusé et inscription publique refusée.
Ne pas lancer ce test avec des identités réelles. Les sessions de test sont
fermées ; aucun mot de passe ni jeton n'est imprimé.
