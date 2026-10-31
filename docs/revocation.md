# Révocation locale

## Deux niveaux de droits

`gestionnaire.demo` est un compte Matrix ordinaire. Son rôle applicatif est
attribué exclusivement dans `server/admin-policy.mjs`. Les comptes agent.a,
agent.b et agent.test sont agents. Le navigateur ne peut pas choisir son rôle.

`service.admin` est un compte technique administrateur Synapse. Son jeton est
lu uniquement par `server/admin-api.mjs`, jamais envoyé au client. Le service
vérifie chaque jeton utilisateur auprès de whoami, puis applique la liste locale
des comptes et rôles. Il refuse de révoquer le gestionnaire ou un compte technique.
La surface exposée comprend seulement me, liste des comptes autorisés et révocation.
Pas de proxy générique vers l'administration Synapse.

`node server/admin-bootstrap.mjs` prépare les quatre comptes fictifs, le compte
technique et son jeton, selon l'API d'enrôlement officielle. Le fichier
`server/runtime/control-service.json` contient le jeton du service. Le mot de
passe technique est réservé au fichier d'identité local, non monté dans Docker.
Ces fichiers sont hors Git, à protéger avec les permissions du système.

## Mécanisme et limites

Le backend appelle POST `/_synapse/admin/v1/deactivate/<user_id>` avec erase=false,
puis vérifie deactivated=true. Synapse invalide les jetons, supprime le mot de
passe du compte et organise sa sortie des salons. Les nouvelles requêtes sont
refusées. La reprise éventuelle exige un nouveau mot de passe et de nouvelles
invitations ; il n'y a pas de bouton de réactivation ordinaire dans le prototype.

Le client écoute les erreurs de synchronisation et vérifie whoami toutes les
cinq secondes : un jeton invalidé ferme l'écran connecté, arrête le moteur et
retire le jeton de sessionStorage. Les erreurs réseau ne sont pas assimilées
à une révocation. Les magasins de clés restent sur l'appareil.

Impossible de reprendre les copies et clés déjà reçues. Une requête en cours
peut avoir reçu des données avant la révocation. La fermeture d'écran n'est pas
une suppression à distance des données. Aucune garantie d'instantanéité absolue.

## Tests et exécution

`node server/admin-api.mjs` démarre sur 127.0.0.1:3001 pour le développement.
Vite transmet /api à ce service. Les requêtes cross-origin sont refusées et le
jeton Bearer est obligatoire. Les secrets sont refusés en HTTP 403 par Vite.
Le conteneur administration_api est uniquement sur des réseaux internes ; le
client Docker expose son interface sur 127.0.0.1:8080.

`node server/check-revocation.mjs` teste de vraies requêtes : 401 sans jeton ou
jeton invalide ; 403 pour un agent et un rôle falsifié ; comptes protégés refusés.
agent.test rejoint un salon, reçoit une session valide, puis est révoqué.
Ancien jeton, sync, historique et nouveau login sont refusés. Résultat observé :
réponse de révocation en 227 ms ; les requêtes déjà en cours ne sont pas mesurées.
Le test laisse agent.test révoqué et conserve A/B actifs.

`node server/check-revocation.mjs --prepare-ui` réactive uniquement agent.test
pour un scénario manuel ; ce compte est réservé à ces tests. Ne jamais adapter
ce script à des identités réelles.

Synapse limite les logins par IP et compte (par défaut 5 en rafale puis 0,003/s).
Des tests rapprochés peuvent demander plusieurs minutes d'attente. Le formulaire
respecte le délai de reprise fourni par le serveur ; aucun seuil n'a été assoupli.

Sources officielles :
- https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#deactivate-account
- https://element-hq.github.io/synapse/latest/usage/configuration/config_documentation.html#rc_login
