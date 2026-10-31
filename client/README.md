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

Authentification, matrix-js-sdk et Rust Crypto seront intégrés ensuite.
Ne pas ajouter d'envoi de messages tant que le moteur E2EE n'est pas initialisé.
