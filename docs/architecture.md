# Décision 001 — architecture minimale

Matrix est le protocole, Synapse son serveur et matrix-js-sdk une bibliothèque
cliente. PostgreSQL conserve les événements ; les fichiers sont dans un volume
séparé. Docker Compose décrit les services et leurs connexions, pas leur sécurité
applicative. Le client React est personnalisé sans réécrire Matrix.

## Frontières de confiance

- Navigateur : mots de passe saisis, jetons de session, clés et texte déchiffré.
- Synapse : authentification, membres, événements chiffrés et médias chiffrés.
- PostgreSQL : données internes Synapse, inaccessible directement depuis l'hôte.
- Futur service d'administration : droits administrateur côté serveur uniquement.
  Aucun jeton administrateur dans une variable VITE ni dans le navigateur.
  Ce service est maintenant `server/admin-api.mjs` ; voir revocation.md.

## Chiffrement avant implémentation

Utiliser Rust Crypto via matrix-js-sdk, sans cryptographie maison. Initialiser
le stockage cryptographique persistant et le moteur avant toute synchronisation.
Créer chaque conversation avec l'état de chiffrement activé avant le premier
message. Vérifier les appareils pour réduire le risque d'usurpation de clés.
Les fichiers doivent être chiffrés avant téléversement, et leur clé envoyée dans
un événement lui-même chiffré. Aucun simple cadenas visuel ne prouve ces propriétés.

La configuration `encryption_enabled_by_default_for_room_type` est une valeur par
défaut, PAS une interdiction serveur des événements en clair. Le module
`server/modules/no_plaintext.py` ajoute maintenant cette interdiction aux voies
ordinaires d'envoi, testée en HTTP 403 (voir message-policy.md).
Un serveur ne peut pas déterminer arbitrairement si tout média envoyé
est réellement chiffré : documenter cette limite et contrôler notre client.

## Identité, sessions et révocation à construire

Inscription publique et invités désactivés. L'administrateur enrôle les comptes.
Le login initial par mot de passe ne constitue pas une authentification forte.
Une intégration OIDC auto-hébergée avec MFA sera évaluée séparément ; aucune
affirmation de MFA avant test effectif.

Révoquer signifie désactiver le compte, invalider ses sessions et exclure les
appareils des futurs échanges de clés. Le scénario de test devra mesurer les
requêtes en cours et vérifier l'absence de nouveaux messages après révocation.
Impossible de reprendre les messages et clés déjà copiés sur un appareil.
Ne pas promettre une instantanéité absolue avant d'avoir mesuré ces courses.

## Métadonnées et réseau

Pas de fédération entrante exposée, liste de fédération sortante vide,
statistiques et présence désactivées. Cela ne masque ni l'identité des membres,
ni la taille des événements, ni les horaires à l'administrateur du serveur.
PostgreSQL reste sur le réseau interne `matrix`. Synapse y accède et possède
également un réseau `client_access` pour publier son API sur 127.0.0.1:8008.
Ce second réseau autorise aussi des connexions sortantes : aucune garantie
d'isolement réseau complet de Synapse. La fédération reste désactivée par la
configuration applicative. Ce n'est pas un audit d'étanchéité.

## Critères P0 avant P1

Deux navigateurs indépendants : login, conversation privée, groupe, fichier,
reconnexion et clés persistantes. Inspecter les événements et médias stockés
pour vérifier l'absence du contenu de test lisible. Tester un appel Matrix brut
qui essaie d'envoyer du texte en clair. Tester inscription publique, utilisateur
non enrôlé et ancien jeton après révocation. Conserver résultats et limites.

## Sources

- https://element-hq.github.io/synapse/latest/setup/installation.html
- https://element-hq.github.io/synapse/latest/usage/configuration/config_documentation.html
- https://github.com/matrix-org/matrix-js-sdk

Les versions du client seront figées au moment de leur intégration. L'image
PostgreSQL utilise provisoirement le canal 17 ; figer les digests après un premier
téléchargement vérifié et avant la démonstration reproductible.
