# NestTrip — Roadmap

Ce document sert de référence pour le projet : ce qui est déjà en place (à ne pas casser) et ce qu'il reste à faire.

## 📋 Plan d'exécution en cours (branche `claude/roadmap-planning-r5e7av`)

Objectif : traiter tout ce qui n'est pas marqué "non prioritaire" ci-dessous. Décisions prises avec l'utilisateur le 2026-07-28 :

- **Vue calendrier** (UI Desktop) : reportée, pas assez spécifiée pour l'instant.
- **Compteur de somme devise** : reporté (un onglet dédié n'est pas voulu, le mettre dans le header prendrait trop de place — à retravailler plus tard).
- **Devise par défaut** : préremplissage des nouvelles saisies uniquement, jamais rétroactif sur les activités/réservations déjà créées.
- **Tri des réservations** : 100% automatique (chronologique, passées en bas) ; le glisser-déposer manuel a été retiré.

Décisions prises avec l'utilisateur le 2026-07-30 :
- **Titre Vol/Train (Logistique)** : passe en texte simple en lecture seule (calculé par la cinématique guidée) + crayon dédié pour l'écraser manuellement, plutôt qu'un champ éditable en première zone de saisie.
- **Ville de retour d'un vol** : pas de traitement spécifique — un aller-retour reste 2 éléments "Vol" distincts créés normalement, annotation retirée du "🔧 À faire".

Items **mis en pause** (structurants, pas assez cadrés pour être lancés sans nouvelle discussion — voir section Qualité/process) : empaquetage mobile (Capacitor ?), secret de déploiement (nécessite une valeur fournie par l'utilisateur).

Décisions prises avec l'utilisateur le 2026-07-31 (section "UX / Interactions") :
- **Cinématique carte du pool Général** : décorrélation totale du scroll (contrairement à la vue jour, inchangée) — tour lent point à point sur 2s d'inactivité, mise en pause (sans jamais forcer la caméra) sur toute action directement sur la carte, reprise du tour là où il en était après 2s. Détail complet dans "✅ Déjà fait".
  - **Correctif (2026-07-31)** : le retour à la vue d'ensemble sur toute action "ailleurs sur la page" (scroll du pool, clic sur une carte d'activité, recherche, tri...) a été retiré — retour utilisateur : ce comportement initial gênait, la cinématique ne doit se mettre en pause QUE sur une action directement sur la carte, jamais ailleurs (`GeneralMapCinematicService` : suppression de `onPageAction`/`onRootPointerDown` et des écouteurs scroll/`pointerdown` associés).
- **Bouton "+"** : le même menu à 7 entrées (Activité + 5 types Logistique + Note) s'ouvre désormais partout, jour ET onglet Général — l'ancienne création directe contextuelle du "+" sur Général est retirée.
  - **Précision (2026-08-02)** : revu — ce menu à 7 entrées reste finalement réservé au contexte jour. Dans le pool général (Activités/Logistique/Listes), le "+" est redevenu spécifique à l'écran affiché. Détail dans "✅ Déjà fait".

Ordre d'exécution : la section "UX / Interactions" (tout ce qui n'est pas "non prioritaire") a été traitée intégralement le 2026-08-02, puis la section "Activités" (tout ce qui n'est pas "non prioritaire") le même jour — voir "✅ Déjà fait" pour le détail des deux lots. Un nouveau lot de puces ajouté depuis à la section "UX / Interactions" a été traité intégralement le 2026-08-04 (9 des 10 items non "non prioritaire" — le 10e, l'accroche onboarding, mis de côté ce jour-là, voir "🔧 À faire") — voir "✅ Déjà fait".

En cours (démarré le 2026-08-04) : section "### UI", fusionnée avec l'étude de direction artistique `DESIGN.md` en une seule grosse livraison visuelle (design system + toolbar + carte + activity card/timeline + mobile-trip-nav + FAB/app-message + graphique Résumé), livrée par phases (un commit logique par phase, `nesttrip-verify` entre chaque). Décisions actées avec l'utilisateur avant implémentation :
- **Icône engrenage (toolbar)** : rotation douce de l'icône pendant que le menu réglages s'ouvre/se ferme (la puce roadmap originale s'arrêtait à "pendant que le menu sort" sans suite), + une vraie animation d'apparition pour le popup desktop (actuellement aucune, contrairement au tiroir mobile).
- **Persistance du toggle carte repliée/dépliée** : vraie préférence utilisateur Firestore (`users/{uid}`, nouveau champ `mapCollapsedByDefault`), pas du localStorage — seule exception logique de ce lot au scope "visuel uniquement" de `DESIGN.md`. `firestore.rules` interdisait jusqu'ici toute écriture client sur `users/{uid}` (champ géré par Cloud Functions) ; la règle est assouplie pour n'autoriser le client à modifier QUE ce champ précis de son propre doc.
- **Carte Google** : retrait des contrôles de navigation par défaut (zoom/compass — pinch/scroll restent), et affinement du style des marqueurs déjà thémés (halo primary sur le marqueur sélectionné).
- **Graphique "types d'activité" (Résumé)** : anneaux concentriques (un par catégorie, longueur d'arc ∝ proportion, légende dessous) plutôt qu'un donut classique — référence visuelle `public/graphisme.png` (fournie par l'utilisateur, remplace `public/graphique.html` qui s'est avéré être une page Freepik morte sans visuel exploitable) ; top 5 combiné activités + transport + logement, couleurs = tokens `--nt-activity-*`/`--nt-logistic-*` déjà existants.

Intercalé le 2026-08-05, sur demande explicite de l'utilisateur : la section "Bugs / fixes" (14/15 items traités, un reste ouvert) + 4 demandes complémentaires hors roadmap — voir "✅ Déjà fait" pour le détail. Le lot "### UI" ci-dessus reste le prochain à reprendre.

Tout ce qui a déjà été livré (avec le détail des correctifs) est listé dans **✅ Déjà fait**, tout en bas.

## 🔧 À faire

### Régressions post-migration OnPush/PrimeFlex/Angular 22 — reste à confirmer par l'utilisateur

Le gros du lot remonté le 2026-07-29 après la clôture des 4 items OnPush/PrimeFlex/Angular 22 (commit `c2e2ee7`), y compris le gel total au clic sur un jour en mode mobile (antérieur à la migration, voir "Déjà fait"), est corrigé et détaillé dans "✅ Déjà fait". Reste :
- Check-in/check-out (réservation) : aucune régression fonctionnelle identifiée dans le code pour "le clavier ne sort plus" — seule cause plausible trouvée et corrigée, le même rétrécissement de largeur que la zone de dates du jour (voir "Déjà fait"). À reconfirmer une fois le correctif de largeur testé ; si le problème persiste, redécrire précisément ce qui se passe (clavier qui ne s'affiche pas du tout ? champ qui refuse la saisie ?).
- Chaînage réservation bloqué à l'heure de début quand elle est saisie en tapant heure puis minute sur le cadran (sans passer par OK) : reproduit via Playwright (clics réels sur le cadran, sans OK) et le chaînage continue bien jusqu'à la date de fin dans ce test — pas confirmé cassé dans le code actuel. Possible que ce soit lié à l'ancien défaut "heure actuelle" du cadran (corrigé, voir "Déjà fait") ou à une nuance tactile réelle (mobile) non reproduite par un clic simulé. À retester maintenant que le cadran démarre à 00:00 ; si ça bloque encore, préciser à quel geste exact (drag vs tap, 1er ou 2e chiffre) ça coince.

### Offline & données (non prioritaire)

- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible

### UI spécifique Desktop

- Vue calendrier (reporté, pas assez cadré)
- Améliorer la vue jour, le résumé de la journé est trop étiré là
- Le scroll auto sur le premier element fait que l'on ne peut pas rester en haut en vu desktop, pas cool 
- Le drag and drop 
- refondre toute la partie générale

### UI 
- Renommer tâche car c'est trop contraignant
- Quand on déclace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? 
- Changer le logo "Adresse" de google en logo de lien de débranchement
- Améliorer le bouton du clider, il ne faut pas que la position de la progresse bar varie en fonction du bouton, elle doit toujout être en sent milieu. et le bouton doit être pleins, de la taille un tout petit peu plus grand que la progress bar, avec un boxshadow, un effet de brillance sur le dessus une ui quali quoi
- Si je bouge l bouton 1, le bouton 2 ne doit JAMAIS bouger, juste la valeur bouge UNIQUEMENT si il est collé sur le bord gauche ou qu'il fait moi que la valeur du bouton 1
- refaire le tracer, ça va pas du tout il passe devant et il est pas jolie du tout je te filerai une image à mettre en background ce sera plus simple
- Quand on créé une nouvelle activité et qu'on met pas les date, le mettre tout en bas en fait, c'est plus logique que tout en haut

### Carte

- Gérer le cas Asie : alternative à Google Maps (non prioritaire)
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)

### Activités

- Suggestions d'activités via la ville dans le pool (non prioritaire)

### Nouveau voyage / IA (non prioritaire)

- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera
- Proposer une amélioration d'itinéraire par jour. Je ne sais pas comment le matérialiser, mais ça permettrait de modifier l'ordre des activité, en prenant compte les horaires d'ouverture et les distances (IA)

### I18n (non prioritaire)

- Variabiliser tous les libellés de l'application dans un fichier de propriété
- faire renaming de tout pour avoir un truc stylé : exemple "Nouvelle aventure" plutôt que "créer un voyage" 
- Internationalisation de l'app (textes)

### Collaborateurs (non prioritaire)

- Email quand ajouté à un trip

### Devise (non prioritaire)

- Gestion de la devise par défaut qui sera affiché à l'utilisateur en fonction d'ou il vient, rajouter pays d'origine dans la demande d'inscription ? Puis modificable via un paramétrage stocké au niveau de l'utilisateur.
- Gérer la devise sélectionnée automatiquement dans les activité / réservations en fonction du lieu de la destination. C'est cette devise qui sera modifiable dan l'onglet "infos"
- Faire évoluer la carte dans l'onglet résumé via un clique sur le montant pour afficher la liste des dépenses dans une popup qui contient un tableau de toutes les dépenses, le tableau aurait 3 colonnes : montant, libellé et date. La dernière ligne contient un bouton + qui permet de rajouter une ligne de dépense ou l'utilisateur est invité à mettre le montant via la devise, le libellé, et la date (initialisée à la date du jour) via un chainage. On peut cliquer pour mopdifier les dépenses rajoutées à la main mais les dépenses associées aux activités sont grisées. même système que pour le reste pour la supression des montant, clique prolongé et multiselection possible.
- il faut également faire un chantier pour que le montant total affiché dans l'onglet info affiche le montant convertie avec la devise de l'utilisateur et la devise du voyage en petit.
- Gérer toutes les conversions de devises 

### UX / Interactions
- Parcours nouveau client, arriver directement sur le champ "Destination" (renommé, voir "✅ Déjà fait") fait bizarre : il faudrait une vraie accroche/salutation avant. Mis de côté (2026-08-04) — le dialog mobile "Destination" s'ouvre immédiatement via la cinématique guidée (`NewTripComponent.startGuidedEntry`/`afterNextRender`), donc un texte posé sur l'écran de fond ne serait jamais vu ; un vrai onboarding demande une réflexion à part (nouvel écran ? étape dédiée avant le chaînage ?), pas juste une phrase ajoutée au-dessus d'un champ.
- Créer le mode avec l'aide pour la premiere fois qu'on utilise l'application : des popup qui expliquent comment faire (non prioritaire)
- Prérenseigner une liste de to take à la création d'un voyage (non prioritaire)
- Rajouter des attributions sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire' (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)
- Rajouter les transports / hotel des notification directement dans la vu d'ensemble (non prioritaire)

- Rajouter sur le choix du nom du trip " Tu pourras le changer après t'inquiète pas" 

Parcours nouveau client, uniquement lorque l'utilisateur vient de créer un compte et n'a pas encore créé de voyage,  quand il se connecte sur l'app : 
  - Avoir une page "Bonjour {Prenom}, prêt à rejoindre l'aventure et créer ton premier voyage ?  Avec un bouton "Créer nouvelle aventure" que te permet de basculer sur l'écran de création de trip. 
  - Il suit ensuite la mécanique pour saisir la destination il faut que le titre sur la pop up soit : "Ou souhaite-tu aller ?" 
  - Une fois la destination saisi, ou la personne à fermé la destination puis clique sur la zone "Nom du voyage", ouvrir la zone de sais i avec le titre sue la popup : "Met ce qui te fait plaisir, tu pourras changer après" 
  - Ensuite, pour les 2 dates, ne rien changer
  Une fois validé, il débranche sur l'écran d'accueil du trip comme l'existant, puis des bulle apparaissent, décrivant les boutons via cinématique ou tu peux faire suivant et précédant pour basculer d'infos en infos. 
  Voila la liste de pop-up à afficher, dans l'ordre chronologique d'affichage, associé à la zone à pointer.Tous le reste de l'écran doit être grisé sauf la zone concernée les boutons suivant et précédent en bas de l'écran via un drawer du même style que la bar pour supprimer. Seul les bouton suivant et précédant sont clicable. Voila la liste   : 
    - Sur le bouton général, avec écrit : 
      ```
      La, tu trouveras 4 sous-menu en rapport avec tout le trip : 

      - Toutes les activitées qui sont sur les jours
      - Les logements et transport qui sont sur les jours 
      - Tes meilleurs todo list pour iren oublier
      ```
    - Sur le bouton résumé , avec écrit : 
      ```
      La, tu trouveras Les infos principales du trip (dates, nom, budget, Pense bête de réservatiobn)
      ```
    - Sur le bouton Activités , avec écrit : 
      ```
      La, tu trouveras Toutes les activitées qui sont sur les jours. 2 mode de fonctionnement possible, tu peux soit : 
      - Créer les activités que tu veux faire sans avoir de date ici, et les dispatcher selon les jour après
      - Soit les créer directement sur le jour précis  
      ```
    - Sur le bouton Transport et Logement, avec écrit : 
      ```
      Même fonctionnement que pour les activités, tu peux les créer là ou sur le jour, et les retrouver au 2 endroits.
      ```
    - Sur le bouton Listes, avec écrit : 
      ```
      La, tu trouveras créer des listes de choses à prendre pour le voyage ou de tips pour une activité en particulier (tu peux les lier)
      ```
    - Sur le jouton "Jour - N", avec écrit : 
      ```
      La, tu trouveras la liste de tous les jours de tout voyage avec la timetables et le détail de chaque activité. Tout activité ou logement se retrouvera ici, ordonné par journé 
      ```



### Bugs / fixes
- A l'ajout d'un train, la cinématique de remplissage ne fonctionne pas — **investigué en profondeur le 2026-08-05** (comparaison octet par octet avec les 4 autres cinématiques guidées qui fonctionnent, chaîne complète `DayLogisticQuickAddService` → `LogisticFocusService` → `LogisticsListComponent` → `LogisticCardComponent` → `guidedTrain()`, `PlaceAutocompleteFieldComponent`, filtrage Google Places backend, historique git) sans cause racine certaine trouvée, aucun correctif appliqué pour ne pas risquer un correctif hasardeux. Piste ouverte non confirmée : `guidedTrain()` est la seule cinématique actuellement exercée qui alterne un dialog CDK `Dialog` (recherche de gare, `openTitleDialog`) ENTRE deux CDK `Overlay` (`guidedDateTime`) — une interaction focus/z-index plausible mais non vérifiable sans navigateur réel (pas d'identifiants `.env.e2e` dans ce sandbox). À reproduire sur un vrai appareil/session avec accès Playwright authentifié pour aller plus loin.

### Qualité / process

- Tests e2e (Playwright) : socle en place le 2026-07-28 (compte de test Firebase Auth dédié, `npm run e2e`) — parcours 1 (login) et 2 (création de trip) couverts, parcours 3 à 7 (activité, form jour, dispatch, réservation, suppression) en backlog, voir `.claude/skills/nesttrip-e2e/SKILL.md`.
- empacter le tout dasn une application pour mobile ? Comment gérer la cohabitation ? — **en pause** : décision d'architecture (Capacitor ? store ?) à prendre avec l'utilisateur avant de commencer, pas lancé dans ce lot.
- Il faudrait faire des dossier pour les composants dans shared, il y a trop d'élément à plat là
- CSS : j'ai pas l'impression que tout utilise les variable et que tout soit bien variabilité : par exemple il y a des 0.5rem et des 0.25rem. Et pour le mode desktop vs mobile, il devrait y avoir un attibut global qui est allimenté soit par 0.25 si mobile, soit 0.5 si desktop et utilisé partout non c'est pas possible ? Ce ne serait pas plus simple ?
- La selection de fichier : le composant est duppliqué entre le pool d'activité et les activités à tord 
- Profiter de anfgular 22 et éviter les async function ! 