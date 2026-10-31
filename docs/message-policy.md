# Politique des événements de salon

`server/modules/no_plaintext.py` utilise le callback officiel
`register_spam_checker_callbacks(check_event_for_spam=...)` de Synapse.
Source : https://element-hq.github.io/synapse/latest/modules/spam_checker_callbacks.html

Pour les événements hors état, seuls `m.room.encrypted` avec une enveloppe
Megolm structurée et les suppressions sans motif libre sont autorisés.
Le texte clair `m.room.message`, les stickers et types personnalisés sont
refusés. Les événements d'état nécessaires (membres, droits, nom, etc.) sont
autorisés ; les autres types d'état sont refusés. Un état de chiffrement sans
l'algorithme Megolm est refusé.

## Limites

La forme d'une enveloppe ne prouve pas sa validité cryptographique : un client
malveillant peut placer des données arbitraires dans `ciphertext`. Le serveur
ne détient pas les clés pour les déchiffrer. Les métadonnées d'état restent
visibles, et peuvent elles aussi être détournées. Ce filtre protège les voies
ordinaires d'envoi de messages, sans prouver l'absence de tout canal de texte.
Le chiffrement des fichiers avant téléversement doit être fait et testé côté
client : cette règle d'événements n'inspecte pas les téléversements de médias.
La liste volontairement réduite des types autorisés peut refuser des extensions
d'autres clients Matrix. Déploiement local sans fédération uniquement.

## Activation

Les nouveaux environnements reçoivent la déclaration du module via prepare.mjs.
Pour la configuration existante, `node docker/enable-message-policy.mjs` ajoute
uniquement cette déclaration et conserve une sauvegarde locale hors Git.
Cette migration a été exécutée dans le projet, sans modifier les secrets.
Compose monte le module en lecture seule, avec PYTHONPATH=/modules.

Appliquer depuis la session Windows qui possède Docker :

```powershell
docker compose up -d --wait --wait-timeout 120
```

Tests unitaires : `python -m unittest discover -s server/modules -p 'test_*.py' -v`.
Les six scénarios passent localement. Après le redémarrage utilisateur,
`node server/check-message-policy.mjs` a confirmé la création d'un salon avec
chiffrement, puis HTTP 403 sur m.room.message et custom.message en clair.
