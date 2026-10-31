# Référence d'interface fournie par l'utilisateur

Source examinée le 31 octobre 2026 : « Messagerie souveraine – Design UI UX.html ».
Ce document est une référence visuelle, pas une preuve de fonctionnalités.

## Direction retenue

- Vert principal #0B5D3B, fond #F4F6F4, texte #14201B, surfaces blanches.
- Écrans mobiles distincts : connexion, discussions, conversation, nouvelle
  conversation, groupes, annuaire, profil/sécurité et état du serveur.
- Administration adaptée au bureau ; messagerie bureau à trois panneaux :
  navigation, liste des discussions, conversation active.
- Identité administrative fictive, libellés français et actions lisibles.

## Adaptations prévues au fil de P0

Utiliser les composants React du projet, des tailles souples plutôt que des
dimensions fixes et un défilement qui laisse tous les contrôles accessibles.
Conserver les états chargement, erreur et nouvelle tentative du client existant.
Ne pas charger de polices depuis Google : police système ou fichiers locaux.
Garder labels, contraste, navigation clavier et zones tactiles confortables.

Les codes OTP et clés de sécurité visibles dans la référence ne sont pas encore
implémentés. Aucun formulaire ne doit simuler leur validation. N'afficher
« chiffré de bout en bout » qu'après vérification de l'état cryptographique réel.
Expiration, limitation du transfert et accusés de lecture demandent leur propre
implémentation et leurs tests ; une capture d'écran ne peut pas être empêchée
universellement. Les instructions de service ne revendiquent aucune valeur
juridique officielle. Annuaire, classifications et instructions restent P1,
après stabilisation de P0.

Cette étape enregistre la direction visuelle ; elle ne remplace pas encore
l'écran de connexion au serveur construit dans le client.
