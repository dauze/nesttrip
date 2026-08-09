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
- Le onover sur les bouton juste texte n'est pas beau, il faut pas faire ça avec primary mais un truc plus doux

### UI 
- Quand on déplace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? (A affiner)
- Retravailler les checkbox pour les mettre ronde, et simplifier tout en les affichants sur mobile aussi 

### Carte
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)

### Activités
- Suggestions d'activités via la ville dans le pool (A affiner)

### Nouveau voyage / IA
- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera -> voir plan process-creation-trip-ia.md
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
- Rajouter un bouton "plus..." sous les avis pour rediriger vers tous les avis de google
- Rajouter la récupération d'une photo à la création du trip et la stocker au niveau du trip pour pouvoir l'afficher au niveau de l'écran d'accueil
- Compléter l'écran de login pour mettre l'envoei de mail, l'activation du code, et la partie mot de passe oublié

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Non prioritaire)
- Ajouter le focus sur la zone de saisie de la dépense, puis le libellé sur les 2 dialogues qui s'ouvrent lors de la cinématique d'ajout d'une dépense sur mobile 
- le dialogue pour saisir une note ne pend pas en compte la taille du clavier et n'est pas centré, il faudrait que la popup, à l'ouverture du clavier, se décale vers le haut. Lorsque l'on saisie du texte, elle doit se décaler vers le haut jusqu'à atteindre le haut de l'écran (azvec un padding standard de l'application), puis un scroll, uniquement sur la partie contenue prend le relais. Il faut également rajouter un compteur de nombre de caractère et arréter de taper quand la limite est atteinte, avec le compteur X/5000 affiché qui passe en rouge quand on a atteind la limite
- Modifier le theme pour rajouter un niveau de couleur : il faut séparer la couleur des contenus type card ou panel pour pouvoir faire un dégradé d'une carte sur le contenue d'un card notemment dans l'écran d'accueil (les élements de chaque voyage devrait avoir une teinte légèrement différente du fond de la card)
- le hover sur les boutons "s'inscrire" et se "connecter" n'est pas bon, il utilise la primary, il devrait être beaucou plus léger (un primary avec une opacité plus faible par exemple)
- Ordonner les voyage dans l'accueil pour mettre du plus proche de la date du jour au moins proche


- Dans résumé, l'affichage n'est pas bon quand certaines fiches sont pas affichés, déplacer le ngif au parent


### Sécurité (non prioritaire)
- Implémenter le mot de passe fort et la vérification par email

### Qualité / process (la cvode review est à faire à la fin !)
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
- Préparer le modele de données pour viser une intégration dans une BDD SQL à postériori
- DayPersistenceService et TripPersistenceService n'extends pas  DebounceWriter<string, ExpenseUpdate>, pourquoi ? 
- day-activity-instance.mapper.ts : faire le nettoyage recommandé
- logistic.mapper.ts on peut variabiliser et factoriser
- trip.dto.ts on peut externaliser le type walk, etc
- das core/services : séparer les services en fonction du type, mettre les services d'appels d'api ensemble, et mettre les services associé à la gestion du l'ui ensemble, et mettre les services busines enssemble
- formatDateParam doit être sorti dans un utils car utilisé à plusieurs endroit 
- mettre le onboarding-sequences.ts à un endroit approprié, ce n'est pas un service
- merger les utils currency-conversion.util et locale-currency.util qui traitent tout les 2 des currency
- DayPickerSheetComponent devrait être dans le shared et n'est pas duppliqué de ActivityDayDispatchOverlayComponent ? factorisation potentiel possible
- MobileTripNavComponent Aussi devrait être dans shared, c'est des composant techniqsues bas niveau qui ne constinue pas un feature mais répodent à une problématique technique 
- Sortir les  MODE_MENU_ENTRIES et GOOGLE_MAPS_TRAVEL_MODE de DayDistanceGapComponent pour les utiliser partout : faire du refactor coté ts aussi. `https://www.google.com/maps/dir/?${params.toString()} ne doit pas être ici mais dans un service dédié
- Les utils associé je sais pas trop si il faut les laisser là ou pas, conseille moi 
- NewActivityDraftComponent c'est quoi ça ? C'est pas un composant qui ressemble déjà à un composant dans shared et a migrer ? genre app-place-autocomplete-field
- TimelineComponent il y a trop de scss, il faut utiliser les class de layout-utilities et surtout ne pas mettre de valeurs en dure ! utiliser le thème 
- TripDayMapComponent même remarque que pour TimelineComponent et il est un peu long, on ne peut pas sortir des méthodes pour en mettre dans un utils ? 
- DayActivityCreationConfig n'a rien a faire là 
- DaypanelComponent : la map, la gérer plus simplement, et ne plus faire d'interpolation, c'était utile avant mais plus maintenant comme elle n'est plus dans le swiper. Il y a beacoup de commentaire dans les scss, garder l'explication des data, pas des explications de features
- day-reorder.service.ts, day-scrollsync ne doivent pas être la ou alors mieux rangé
- DraggableDayRow doit être renommé et déplacé 
- les services de core avec les repos, il faudrait pas plutôt faire des interface plutôt que des abstract class et faire des extends ? 
- FlightStatusBadgeComponent : badgeMetaFor doit être une constante plutîot 
- initialPlacesFrom de LogisticDetailsComponent idem
- LogisticHeaderComponent le scss a trop de valeur en dur et pas assez de primeflex. 'startDate' | 'startTime' | 'endDate' | 'endTime' créer une type réutilisable non ? C'est utilisé à d'autres endroit il me semble 
- Logistic place info : pas appelé d'url direct, c'éer un service : `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${place.placeId}`;
- LogisticCardComponent le scss a voir si il n'est pas simplifiable 
- LinkActivityDialogComponent trop de scss en dur
- NotesComponent on peut pas un peut factoriser le front ? 
Remarque générale, pas assez d'externalisation des type avec des réécriture à plusieurs endroit, il faut factoriser 


### Industrialisation (non prioritaire)
- Faire une étude pour savoir les prochaines étapes pour potentiellement industrialiser l'application : 
  - Changement de la base vers une base postgres en conservant l'hydratation en temps réel
  - Réduire les cout en changeant de firebase à autre chose, à voir la renta
  - Gestion token multienv
  - Passage sur AppStore et Playstore ?
  - Gérer le cas de l'asi sans google ni les services google, quelles alternatives ?
  - faire sa banque de svg et se passer de prime-icons