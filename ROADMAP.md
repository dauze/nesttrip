# NestTrip — Roadmap

Ce document sert de référence pour le projet ce qu'il reste à faire.


### Offline & données (non prioritaire)

- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible (A affiner)

### UI spécifique Desktop (A affiner)

- Vue calendrier (A affiner)
- Améliorer la vue jour, le résumé de la journé est trop étiré là
- Le scroll auto sur le premier element fait que l'on ne peut pas rester en haut en vu desktop, pas cool 
- Le drag and drop 
- refondre toute la partie générale

### UI 
- Quand on déclace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? (A affiner)
- Specs/Parcours-new-user.md : fonctionnalité à part entière à développer (Non prioritaire)
- Tuile Dépenses : modifier la disposition : il faut mettre le graphyque et la légende cote à cote et non l'un sur l'autre. A gauche il y aura le graphique et à droite du donut. Il ne faut pas que le texte soit tronqué donc il faut que si il faut peut être réduire un petit peu la taille du donut et que ce soit responsive, si ça tient pas, le mettre en dessous dans la même disposition qu'actuellement. Centrer la légende versicallement (pas horizontalement) comme ça si elle est à coté du donut et qu'il estp lus large, ils seront alignés
- Modification visuel des boutons (pour le mobile uniquement), il doivent maintenant être plus grand et remplir toute la zone ou ils sont, sans bordures, et donc agrandir le libellé :
  - Sur toutes les popup, les boutons du bas doivent être revue sur mobile, il doivent être plus gros et prendre toute le footer en le divisant par 2
  - Agrandir le bouton "Nouvelle aventure" sur mobile pour qu'il prenne toute la largeur du footer
  - Agrandir les boutons "Annuler" et "Créer un voyage" sur mobile pour qu'il prennent tout le footer divisé par 2 comme sur les popup
  - La pop-up informative de fichier trop gros a 2 bouton ok, il faut en mettre qu'un seul qui prend tout le footer
  - Sur l'écran de création d'un voyage, les 2 boutons "Annuler" et "Créer un voyage" doivent prendre tout le footer en le divisan par 2 "
- Uniformiser les suppression via le clique sur des élements : sur l'écran d'accueil il y a un contour et pas sur les autres, le supprimer. L'opacity n'est peut-etre pas la même, a uniformiser. On ne voit pas assez le rouge de sélection sur les carte de logement, transport, et activité, et Listes il faut l'accentuer légèrtement. Enfin, pour logement, transport, activité et liste faire cette sélection sur les headers également pour que toute la carte soit en rouge, pas que le contenu. 

### Carte

- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)

### Activités

- Suggestions d'activités via la ville dans le pool (A affiner)

### Nouveau voyage / IA

- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera (A affiner)
- Proposer une amélioration d'itinéraire par jour. Je ne sais pas comment le matérialiser, mais ça permettrait de modifier l'ordre des activité, en prenant compte les horaires d'ouverture et les distances (IA) (A affiner)

### I18n (non prioritaire)

- Variabiliser tous les libellés de l'application dans un fichier de propriété
- faire renaming de tout pour avoir un truc stylé : exemple "Nouvelle aventure" plutôt que "créer un voyage" 
- Internationalisation de l'app (textes)

### Collaborateurs (non prioritaire)

- Email quand ajouté à un trip

### UX / Interactions

- Prérenseigner une liste de to take à la création d'un voyage et des activités en arrivant sur l'IHM ? Que sur le premier trip qsue l'on créé, pour la cinématique ? (A affiner)
- Rajouter les transports / hotel des notification directement dans la vu d'ensemble (A affiner)
- Pour les notifications des transports / hotel, voir ou les mettre car c'est pas jolie actuellement, comme c'est le même affichage que les activités et que les activités sont dans un panel, on dirait que l'écran n'est pas uniforme (A affiner)

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Plus tard)
- remettre les pointillés affiché dans le calcule de distance, day-distance-gap-rail__line n'est plus visible

### Qualité / process

- empacter le tout dans une application pour mobile ? Comment gérer la cohabitation ? décision d'architecture (Capacitor ? store ?) à prendre avec l'utilisateur avant de commencer  (non prioritaire)
- Il faudrait faire des dossier pour les composants dans shared, il y a trop d'élément à plat là (reporté le 2026-08-07, 73 fichiers d'imports impactés — pas prioritaire pour l'instant)
- Profiter de anfgular 22 et éviter les async function ! 
- Définir des spec pour tout le code pour les parcours utilisateurs (et donc mettre des tests e2e qui couvrirait les différentes spec)
- Faire une code review de fond avec Fable pour voir si il y a pas de simplification, audit de sécurité, tests, etc : (Non prioritaire, à faire par fable)
  - CSS : j'ai pas l'impression que tout utilise les variable et que tout soit bien variabilité : par exemple il y a des 0.5rem et des 0.25rem. Et pour le mode desktop vs mobile, il devrait y avoir un attibut global qui est allimenté soit par 0.25 si mobile, soit 0.5 si desktop et utilisé partout non c'est pas possible ? Ce ne serait pas plus simple ?
  - html : pas de redondance ? 
  - typescript uniforme ? Signal bien géré, observable aussi ?
  - Problème d'incohérence : il y a 2 composants pour la liste sur mobile, un avec le check et un avec la ligne en surbrillance, il faudrait les fusionner pour en avoir qu'une seule

### Industrialisation (non prioritaire)

- Faire une étude pour savoir les prochaines étapes pour potentiellement industrialiser l'application : 
  - Changement de la base vers une base postgres en conservant l'hydratation en temps réel
  - Réduire les cout en changeant de firebase à autre chose, à voir la renta
  - Gestion token multienv
  - Passage sur AppStore et Playstore ?
  - Gérer le cas de l'asi sans google ni les services google, quelles alternatives ?