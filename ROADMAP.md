# NestTrip — Roadmap

Ce document sert de référence pour le projet ce qu'il reste à faire.

### Plan d'exécution en cours (2026-08-11)
- Génération de voyage assistée par IA (voir "Nouveau voyage / IA" ci-dessous et `src/specs/process-creation-trip-ia.md`) : repris malgré le statut "non prioritaire", à la demande explicite de l'utilisateur. Découpage en lots suivi tel que défini dans la spec (§7) :
  - **Lot 1 (front-only) — fait.** 4ᵉ carte "Je planifie moi-même"/"Laisser l'IA m'aider" (`app-select-button--solid`) sur l'écran "Nouveau voyage", affichée une fois Destination/Nom/Dates renseignés ; en mode IA, panneau de préférences (niveau d'assistance, type de voyageurs, rythme, centres d'intérêt, plusieurs villes, texte libre) — état purement local au formulaire, rien n'est envoyé au backend. L'auto-soumission mobile en fin de cinématique guidée (Ville → Nom → Dates) a été retirée : l'utilisateur doit désormais taper explicitement "Créer le voyage".
  - **Lot 2 (pipeline `activities_only` end-to-end) — fait, avec réserves (voir ci-dessous).** Nouvelle collection Firestore séparée `tripGenerations/{tripId}` (délibérément hors du doc `trips/{tripId}` — voir `TripGeneration`, doc de classe) + Cloud Function déclenchée par `onDocumentWritten` (`functions/src/trip-generation/generate-trip.trigger.ts`, couvre création ET "Régénérer tout") : recherche Google Places élargie par centre d'intérêt (`searchNearby`, `search-activities.ts`) → sélection (`select-activities-stub.ts`) → écran de génération (`/trips/:id/generating`) → aperçu avec Exclure/Remplacer/Régénérer (`/trips/:id/preview`) → "Valider" crée les vraies activités (`PoolActivity.source: 'ai_generated'`, badge "Suggéré par IA" sur la carte).
  - **Lot 3 (`full_plan`, décisions actées avec l'utilisateur le 2026-08-11) — fait.** `activities_day` (pool + placement par jour, pas de logistique) et `full_plan` (+ logements + trajets estimés) débloqués côté formulaire. Logements : recherche Google Places (`includedTypes: ['lodging']`, `search-lodging.ts`) — un logement par ville, réservoir pour "Remplacer". Transports inter-villes : **pas d'appel API réel** (décision actée), estimation générique par distance à vol d'oiseau (`transport-estimate.ts`, "~Xh estimées (route/train ou vol)"). Multi-villes : les villes additionnelles (simples strings saisies au Lot 1, sans coordonnées) sont géocodées côté serveur (`geocode-city.ts`) uniquement en mode `full_plan` multi-villes. Répartition des activités par jour : round-robin par intérêt, nombre par jour selon le rythme choisi (2/3/4, voir `ACTIVITIES_PER_DAY`). Validation : activités placées sur le bon jour (`TripFacade.createActivity`), logements/trajets créés comme `Logistic` classiques (`type: 'logement'`/`'train'`) via `TripFacade.createLogistic` — **pas de badge "Suggéré par IA" sur ces `Logistic`** (le concept de provenance n'existe que sur `PoolActivity` pour l'instant, non étendu à `Logistic` cette session).
  - **Lot 4 (régénération ciblée d'un seul jour) — pas commencé, décision actée avec l'utilisateur le 2026-08-11 : reporté.** La spec elle-même (§7) le conditionne aux retours d'usage réel des Lots 2/3, qui n'existent pas encore (pas de compte de test/déploiement possible cette session) — à reprendre après un usage réel, pas avant.
  - **Correctif 2026-08-11 (activités générées incomplètes)** : le modèle Gemini appelé (`gemini-2.5-flash`, branché lors du lot précédent) répondait `404 "no longer available to new users"` sur chaque appel réel — repli silencieux sur le stub déterministe, jamais remarqué. Basculé sur l'alias maintenu à jour `gemini-flash-latest` (vérifié en conditions réelles avec la clé du projet). Champs d'activité désormais tous renseignés à la validation (`PreviewComponent.validate`), avec une portée différenciée par niveau d'assistance : `full_plan`/`activities_day` reçoivent type + durée + prix + horaires (début/fin dérivés séquentiellement dans la journée à partir d'une durée estimée par le LLM, départ 09:00, battement de 30min) ; `activities_only` reçoit type + durée + prix mais aucun horaire (pas de jour assigné) via une `DayActivityInstance` **orpheline** (nouveau pattern `TripStore.createGeneralActivity(tripId, poolActivity, instance?)`/`addOrphanDayActivityInstance` — instance persistée mais rattachée à aucun jour, affichée via le mécanisme de secours déjà présent dans `getPoolActivityView`/`composePoolView`, nettoyée par `removePoolActivity` au même titre que les instances de jour).
  - **Refonte 2026-08-11 (le LLM planifie, Google enrichit)** : le correctif précédent laissait le problème de fond entier — le pool venait de `searchNearby` par catégorie générique (classé par popularité), le LLM ne faisant qu'un tri de surface dedans, donc `freeText` ("Dites-nous en plus") n'influençait presque rien et "insolite" (`offbeat`) restait mappé sur le type Google le plus touristique (`tourist_attraction`). Inversé : nouveau chemin **primaire** (`plan-trip-llm.ts` + `enrich-activities-with-places.ts`) où le LLM invente directement l'itinéraire (lieux réels de sa connaissance, pas de pool Google en entrée) à partir des préférences complètes — intérêts, texte libre, **nouveau champ `budgetMaxEur`** ("Budget max des activités") — puis planifie lui-même l'enchaînement du jour (ordre, horaires `startTime`/`endTime`, en estimant lui-même le temps de trajet entre activités, **pas d'appel API de routing réel** ; **pas de prise en compte des horaires d'ouverture réels**, décisions actées avec l'utilisateur). Google Places (`places:searchText`, un appel par activité proposée) n'intervient qu'ensuite pour ancrer chaque activité dans un vrai lieu (placeId/adresse/coordonnées/photos) — une activité que Google ne retrouve pas est écartée (garde-fou anti-hallucination). `applyBudgetCap` (post-traitement, best-effort) retire les activités les plus chères si le total dépasse `budgetMaxEur`. Le pipeline historique (`searchActivityCandidates`/`select-activities-llm.ts`/`select-activities-stub.ts`) devient le chemin de **repli** (pas de clé Gemini, exception, ou zéro activité après enrichissement) — inchangé sinon. Limitation connue et acceptée : sur le chemin primaire, "Remplacer" n'a rien d'autre à proposer (pas de pool plus large que ce qui est montré) ; logement/transport (`full_plan`) restent sur le pipeline historique, non contraints par le budget.
  - Diagnostic confirmé en conditions réelles (`firebase functions:log`, appel direct à l'API Gemini avec la clé du projet) — mais toujours aucune vérification visuelle dans l'app (pas de compte de test `.env.e2e` fonctionnel cette session, login e2e en échec pour une raison indépendante de ce travail) : la refonte reste à confirmer par l'utilisateur après déploiement (`firebase deploy --only functions:generateTrip`), une vraie génération dans les 3 modes.
  - **Correctif 2026-08-12 (horaires pas respectés, activités hors moment réaliste — ex. boîte de nuit proposée l'après-midi)** : retour utilisateur sur la refonte précédente. Toujours pas de champ horaire précis par activité demandé au LLM (cause déjà connue : ça fait dérailler la sortie structurée `gemini-flash-latest`, voir `plan-trip-llm.ts`) — deux champs d'une autre nature ajoutés à la place. Par activité, `timeOfDay` (ENUM `morning`/`afternoon`/`evening`/`night`, même forme fiable qu'`interest`) — ajouté aux deux chemins (primaire `plan-trip-llm.ts` et repli `select-activities-llm.ts`, qui n'avait jusqu'ici aucune consigne d'horaires d'ouverture). Une seule fois par réponse (chemin primaire uniquement, pas de risque pris sur le schéma `Type.ARRAY` bare du repli), `dayStartHour`/`dayEndHour` (INTEGER 0-23, détectés dans `freeText` si l'utilisateur exprime une heure de début/fin de journée souhaitée). Le curseur horaire de `PreviewComponent.validate()` (jusqu'ici un empilement séquentiel aveugle depuis 09:00 fixe, sans lien avec `freeText` ni le type d'activité) part désormais de `dayStartHour`, plafonne à `dayEndHour` (active en trop supprimées, même logique que `apply-budget-cap.ts`), et "saute" au créneau horaire réaliste du `timeOfDay` de chaque activité plutôt que d'empiler à la suite — une activité `night` peut légitimement déborder sur le lendemain via `endDayOffset` (pattern déjà existant sur `DayActivityInstance`), mais aucune nouvelle activité n'est jamais démarrée après minuit. Encore best-effort (connaissance du LLM, aucune vérification d'horaires réels via une API externe) — à confirmer par l'utilisateur après déploiement, comme les correctifs précédents.
  - **Correctif 2026-08-12 bis (vrai planificateur de journée + notes générées)** : le correctif précédent restait trop grossier (4 buckets `timeOfDay`) pour `activities_day`/`full_plan` — retour utilisateur demandant un vrai raisonnement de planificateur (horaires réels, heures d'affluence à éviter, repas midi ET soir aux horaires locaux réels) et des notes générées par l'IA. Chemin primaire uniquement (`plan-trip-llm.ts`) : `suggestedStartHour`/`suggestedStartMinute` par activité (deux `Type.INTEGER`, même classe de champ que `day`/`duration`/`price` déjà fiables — pas un STRING "HH:mm"), résolus en `suggestedStartMinutes`, prioritaires sur `timeOfDay` dans `PreviewComponent.resolveDaySchedule`. Mandat repas (`MEAL_SLOTS_PER_DAY = 2`, constante locale à ce fichier, n'affecte pas `ACTIVITIES_PER_DAY` partagé avec le repli/stub) : déjeuner ET dîner chaque jour aux horaires réels de la ville/du pays visité, sauf texte libre contraire. Prompt étendu pour éviter les heures d'affluence connues et favoriser les meilleurs créneaux, sans jamais inventer un événement incertain. Nouveau champ `notes` par activité (remarque pratique courte type "réserver à l'avance" — ajouté aux DEUX chemins, même forme fiable qu'un `reason` libre déjà utilisé), consommé dans `DayActivityInstance.notes` à la validation (jusqu'ici toujours `''`). Nouveau : `generalNotes` (packing list, choses à ne pas oublier), 1 à 4 par génération, devenant de vrais `Item` du système de notes existant (`NotesType.TODO`/`INFO`, voir `notes.model.ts`) via `TripFacade.createItem` à la validation — optionnellement liés à une activité précise (`Item.linkedActivityInstanceId`). Lien résolu par INDEX côté serveur (dans `plan-trip-llm.ts`, au moment même où `activities` finale est construite, avant tout risque de dérive de titre à l'enrichissement Google) plutôt que par un matching de titre a posteriori — `enrichActivitiesWithPlaces` renvoie désormais aussi `candidateIdByPlannedIndex`, résolu en `relatedCandidateId` stable dans `generate-trip.trigger.ts`, puis en `linkedActivityInstanceId` réel côté client (activité exclue ou non retrouvée par Google ⇒ note créée sans lien, jamais perdue). `maxOutputTokens` 12000 → 20000 (plus de champs par activité + repas en plus + tableau `generalNotes`). Limitation connue et acceptée : un repas mandaté peut être retiré par `applyBudgetCap` sous budget très serré (documenté dans son JSDoc, pas de logique dédiée). Encore best-effort côté horaires/repas/événements — à confirmer par l'utilisateur après déploiement, même exigence que les correctifs précédents.

### Offline & données (non prioritaire)
- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible (A affiner)

### IA 
- Il faut que tu améliores la génération de parcours par IA : Il a le champs "Statut" avec a reserver ou réservé qui doit être renseigné par l'iA si celle-ci pense qu'il faut réserver. Une deadline est alors à positionner, du temps qu'elle pense qu'il faut pour réserver en avance : par exemple, si on doit reserver une semaine en avance, alors il faut mettre une deadline une semaine avant la date positionné. Idem pour les logements et les transports. 
- Il faut améliorer le traitement si jamais on a besoin d'une location de voiture, le conseiller
- Renseigner les date de début et de fin pour les logements 

### UI spécifique Desktop (A affiner)
- Vue calendrier (A affiner)
- Améliorer la vue jour, le résumé de la journé est trop étiré là
- Le scroll auto sur le premier element fait que l'on ne peut pas rester en haut en vu desktop, pas cool 
- Le drag and drop 
- refondre toute la partie générale
- Le onover sur les bouton juste texte n'est pas beau, il faut pas faire ça avec primary mais un truc plus doux

### UI 
- Quand on déplace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? (A affiner)
- Séparer le paramétrage du trip de celui de générale, mais ou mettre le clique ? (A affiner)
- Dialogue note : ne doit pas permetre de saisir plus de caractères qure 5000 avec une animation sur le compteur qui check à chaque saisie supérieur à 5000; le repositionnement clavier (VisualViewportService) ne fonctionne pas sur cette popup mais sur tous les autres oui, lorsque j'affiche la popup, le clavier s'ouvre, et la popup n'est pas décalée vers le haut comme pour les autres popup 
- Les deadlines sur mobile sont cliquable en dehors de leur zone, il faudrait que la zone cliquable soit la tail de l'input, pas plus (comme les autres champs)
- Pour le login, réaliser la page de réinitialisation du mdp et la page de confirmation après activation du lien dans le même style que le login
- Retravailler l'ui de l'écran d'accueil : mettre du box shadow sur la carte, supprimer le padding entre la photo et le bords et supprimer les round sur le coté droite de l'image, la rendre plus jolie. Et échanger la couleur, la carte doit être blanche, et le contenu un peu plus foncé mais moins que le foncé du background (un dégradé). Attention lorque l'on selectionne une carte pour le mode suppression il y a 2 problèmes : il n'y a pas de paddign entre la checkbox et la pohto, et si une carte est grise car ce n'est pas mon voyage, quand je clique dessus ça déplenche le clique à tord
- Pour la selection lors de la suppression, il faudrait pas plutît mettre la coueur primary ? Ce serait plus jolie non ? 
- Le logo affiché dans le libellé de "Prix" doit être le logo de la currency de la personne 
- Si il n'y a pas d'activité, la carte doit être centré sur le placeid du trip, pas paris 
- Dans les settings du trip, pouvoir changer la destination, cela changerais aussi la photo
- déplacer les settings du trip pour les mettre ailleurs que sur les settings généraux (A affiner) 
- Supprimer le champs "Note" des activitées et Logement et transport car c'est maintenant les listes, et remplacer liste par note ? (A affiner) 

### Carte
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)

### Activités
- Suggestions d'activités via la ville dans le pool (A affiner)

### Nouveau voyage / IA
- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera -> voir plan process-creation-trip-ia.md :
- L'ia doit également proposer dans le prompt un endroit ou manger aux heure prévue 
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
- Si je suis sur un jour et que je clique sur "Générale", la map reste, à tord 

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