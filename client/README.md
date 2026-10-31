# Client web — première connexion

React et TypeScript affichent un état calculé depuis la vraie API Matrix.
Vite sert l'interface et transmet `/_matrix` à Synapse sur 127.0.0.1:8008.
Ce proxy concerne le développement ; le déploiement final nécessitera son
propre routage. Ni police distante ni service externe dans l'interface.

Depuis `client/` :

```powershell
npm ci
npm run build
npm run dev
```

Ouvrir http://127.0.0.1:5173. Synapse démarré : état « Serveur Matrix accessible ».
Serveur arrêté : état d'erreur sous huit secondes. Le bouton relance le test.
Le client vérifie le statut HTTP et la structure de la réponse.

Le formulaire utilise matrix-js-sdk 45.0.0. `src/matrix.ts` initialise Rust Crypto
avec IndexedDB avant de synchroniser. Les comptes fictifs sont enrôlés depuis
le script serveur ; aucun secret d'enrôlement dans ce client. Le jeton est
conservé dans sessionStorage, le mot de passe n'est pas persisté. La reprise
après rechargement conserve l'identifiant d'appareil et le magasin de clés.
Déconnexion : invalidation du jeton côté serveur puis retrait local.
Voir `../docs/authentication.md`. Aucun envoi de messages à ce stade.
