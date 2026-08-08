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
- rajouter une popup de onboarding-drag-hint pour déclencher la "coach-mark-overlay"lorsqeu l'utilisateur clique sur la premiere fois sur une activité créé depuis le pool d'activité, que ce soit le drag and drop ou non. Le text est "Pour placer une activité sur un jour, il faut maintenir lien de drag and drop et déplacer l'activité dans le jour associé du calendrier qui apparaîtra."

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Non prioritaire)
- Le bloc voyage des paramètre ne doit pas être affiché quand on est sur l'écran de création d'un voyage
- Sur l'écran d'accueil, il faut que le bouton créer un trip soit positionné en bas de l'écran, et que le scoll soit dans le conent du panel, pas sur tout le panel
- "Aucune activité pour l'instant, n'hésitez pas à en créer avec le bouton +." on doit changer le plus en icone de map. idem pour l'icone de logement et transport" et "Liste"

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
  - Pour tous les composants de base qui sont dans shared comme bouton, select, chip, etc : vérifier que tous les composants du commun se basent la dessus et ne réinvente pas les boutons, chip, select, etc, il ne faut pas redéfinir à chaque fois les éléments, Pour rappel, les composant dans le dossier feature ne doivent quasiment pas avoir de scss car le scss du théme doit être défini dans les fichiers du theme et exploité par les composant commun du shared. les composant de feature sont que des composants qui utilisent les composants de shared sans redéfinir de thème. Role des composant de shared : définir des composant dumbs réutilisable qui implémente le thème. Role des components de feature : utiliser les components de thème et implémenter les logiques par écran. seul du scss de règle de placement doit être définit dans les components de feature via des classes dse layout utilities dans le html directement
  - Fusionner app-menu et app-select qui sont les même, non ? 
- Déplacer travel-tier-dialog, il n'a plus rien à faire ici
- #dragPortal le mecanisme du portal pour la carte n'a plus lieu d'être car elle est completement sorti du swiper, il faudrait l'enlever 
### Industrialisation (non prioritaire)

- Faire une étude pour savoir les prochaines étapes pour potentiellement industrialiser l'application : 
  - Changement de la base vers une base postgres en conservant l'hydratation en temps réel
  - Réduire les cout en changeant de firebase à autre chose, à voir la renta
  - Gestion token multienv
  - Passage sur AppStore et Playstore ?
  - Gérer le cas de l'asi sans google ni les services google, quelles alternatives ?
  - faire sa banque de svg et se passer de prime-icons