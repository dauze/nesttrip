# NestTrip — Roadmap

Ce document sert de référence pour le projet ce qu'il reste à faire. Les items clos sont déplacés vers `ROADMAP_already done.md` (voir ce fichier pour l'historique détaillé) — ne pas les redupliquer ici.

### Plan d'exécution en cours (2026-08-11)
- Génération de voyage assistée par IA : Lots 1 à 3 faits, voir `ROADMAP_already done.md`. **Lot 4 (régénération ciblée d'un seul jour) — pas commencé, décision actée avec l'utilisateur le 2026-08-11 : reporté.** La spec elle-même (`src/specs/process-creation-trip-ia.md` §7) le conditionne aux retours d'usage réel des Lots 2/3 — à reprendre après un usage réel, pas avant.

### Offline & données (non prioritaire)
- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible (A affiner)

### IA 
- Il faut que tu améliores la génération de parcours par IA : Il a le champs "Statut" avec "a reserver", "sans réservation", "réservé" qui doit être renseigné par l'iA si celle-ci pense qu'il faut réserver. Une deadline est alors à positionner, du temps qu'elle pense qu'il faut pour réserver en avance : par exemple, si on doit reserver une semaine en avance, alors il faut mettre une deadline une semaine avant la date positionné. Idem pour les logements et les transports.
- Il faut améliorer le traitement si jamais on a besoin d'une location de voiture, le conseiller via un transport ajouté (renseigner tpute les zones 
- Renseigner les date de début et de fin pour les logements 
- Certains item peuvent etre généré de manières generale sans les assigner à une activité, par exemple les infos sur une destination, les tutor avant de venir, les infos à savoir sur les costumes, etc
- Si une activité depasse 00h00, l'ia doit renseigner l'info "J+1", "J+2"
- De manière générale, l'ia doit renseigner absolument toutes les données qu'ils y a sur les activités, logements et transports, infos, etc. Refaire un scan complet pour vérifier qu'aucune infos n'est mise en dur durant le process de création de trip à partir de generation trip

### UI spécifique Desktop (A affiner)
- Vue calendrier (A affiner)
- Améliorer la vue jour, le résumé de la journé est trop étiré là
- Le scroll auto sur le premier element fait que l'on ne peut pas rester en haut en vu desktop, pas cool 
- Le drag and drop 
- refondre toute la partie générale
- Le onover sur les bouton juste texte n'est pas beau, il faut pas faire ça avec primary mais un truc plus doux

### UI 
- Quand on déplace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? (A affiner)
- Dialogue note : ne doit pas permetre de saisir plus de caractères qure 5000 avec une animation sur le compteur qui check à chaque saisie supérieur à 5000; le repositionnement clavier (VisualViewportService) ne fonctionne pas sur cette popup mais sur tous les autres oui, lorsque j'affiche la popup, le clavier s'ouvre, et la popup n'est pas décalée vers le haut comme pour les autres popup 
- Pour le login, réaliser la page de réinitialisation du mdp et la page de confirmation après activation du lien dans le même style que le login ou que la page de auth guard 
- Retravailler l'ui de l'écran d'accueil : mettre du box shadow sur la carte, supprimer le padding entre la photo et le bords et supprimer les round sur le coté droite de l'image, la rendre plus jolie. Et échanger la couleur, la carte doit être blanche, et le panel qui contient les panel de trip un tout petit peu plus foncé que le fond mais moins que les cartes des trip. Attention lorque l'on selectionne une carte pour le mode suppression il y a 2 problèmes : il n'y a pas de padding entre la checkbox et la photo, et si une carte est grise car ce n'est pas mon voyage, quand je clique dessus ça déplenche le clique à tord : il faut que le clique soit désactivé en mode modifications sur les cartes non supprimable
- Pour la selection lors de la suppression, il faudrait pas plutît mettre la couleur primary plutôt que le rouge, ce sera plus jolie
- Le logo affiché dans le libellé de "Prix" doit être le logo de la currency de la personne 
- Dans les settings du trip, pouvoir changer le multi destination, cela changerais aussi la photo si il change la destination principale
- Dans le parcours de création d'un trip, il faudrait déplacer le remplissage du champs "plusieurs destinations ?" Pour qu'il soit avant la saisie de l'ia et toujours saisissable 
- sur le déplacement de la camera sur la carte dans résumé, la faire moins varier en recul et accélérer un peu les transitions. Il faudrait également rajouter les titres des activités avec les photos. Je ne sais pas comment faire ça de manière compact et UI, propose moi un truc bien. (A affiner — demande explicite de proposition UX avant implémentation, décision actée le 2026-08-13 : laissé de côté cette session)
- Retirer les infos relatives au voyage du drawer général de la roue cranté en haut
- créer un nouveau drawer qui aura uniquement les paramètres du voyage, son ouverture sera uniquement au clique sur le trip header.
- Dans l'onglet résumé, modifier le trip header : il faut rajouter en fin de carte un logo de réglage (autre que la roue cranté pour ne pas faure doublon). Au clique, l'utilisateur arrivera sur le drawer qui contiendra uniquement les paramètres relatifs au voyage. pour rajouter une information pour cliquer sur le voyage et a l'ouverture il y aura uniquement la modification du voyage dans un drawer séparé

### Carte
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)

### Activités
- Suggestions d'activités via la ville dans le pool (A affiner)

### Nouveau voyage / IA
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
- Rajouter les transports en commun comme moyen de transports
 

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Non prioritaire) 

### Qualité / process (Non prioritaire, la cvode review est à faire à la fin !)
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
