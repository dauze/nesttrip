# NestTrip — Roadmap

Ce document sert de référence pour le projet : ce qui est déjà en place (à ne pas casser) et ce qu'il reste à faire.

## 📋 Plan d'exécution en cours (branche `claude/roadmap-planning-r5e7av`)

Objectif : traiter tout ce qui n'est pas marqué "non prioritaire" ci-dessous. Décisions prises avec l'utilisateur le 2026-07-28 :

- **Layout desktop (carte gauche / activités droite, jours en haut)** : s'applique aussi au mobile en position allongée (landscape), pas seulement au vrai desktop.
- **Vue calendrier** (UI Desktop) : reportée, pas assez spécifiée pour l'instant.
- **Compteur de somme devise** : reporté (un onglet dédié n'est pas voulu, le mettre dans le header prendrait trop de place — à retravailler plus tard).
- **Devise par défaut** : préremplissage des nouvelles saisies uniquement, jamais rétroactif sur les activités/réservations déjà créées.
- **Tri des réservations** : 100% automatique (chronologique, passées en bas) ; le glisser-déposer manuel a été retiré.

Items **mis en pause** (structurants, pas assez cadrés pour être lancés sans nouvelle discussion — voir section Qualité/process) : empaquetage mobile (Capacitor ?), secret de déploiement (nécessite une valeur fournie par l'utilisateur).

Ordre d'exécution prévu pour le reste :
1. **Bugs / fixes** liés au geste/à l'animation (drag&drop sous calendrier, animation cdkDrag, sursaut calendrier, scroll post-drop, aiguilles horaire) — **non vérifiés visuellement** : Google Maps/Fonts sont bloqués par la politique réseau de l'environnement d'exécution (proxy renvoie 403), donc `ng serve`/`ng build` n'y suffisent pas pour tester visuellement — à tester côté utilisateur.
2. **UX/Interactions** restantes (redirection single-trip, barre sticky, max-width des champs, préremplissages, saisie clavier calendrier).
3. **Carte** (carte pliée dans Général, fermeture carte pendant édition via dialog mobile, clarté visuelle carte superposée).
4. **Activités** (widget horaire simplifié, affichage multi-jours).
5. **UI Desktop / landscape** (redesign le plus large, fait en dernier).

Tout ce qui a déjà été livré (avec le détail des correctifs) est listé dans **✅ Déjà fait**, tout en bas.

## 🔧 À faire

### Régressions post-migration OnPush/PrimeFlex/Angular 22 — reste à confirmer par l'utilisateur

Le gros du lot remonté le 2026-07-29 après la clôture des 4 items OnPush/PrimeFlex/Angular 22 (commit `c2e2ee7`), y compris le gel total au clic sur un jour en mode mobile (antérieur à la migration, voir "Déjà fait"), est corrigé et détaillé dans "✅ Déjà fait". Reste :
- Check-in/check-out (réservation) : aucune régression fonctionnelle identifiée dans le code pour "le clavier ne sort plus" — seule cause plausible trouvée et corrigée, le même rétrécissement de largeur que la zone de dates du jour (voir "Déjà fait"). À reconfirmer une fois le correctif de largeur testé ; si le problème persiste, redécrire précisément ce qui se passe (clavier qui ne s'affiche pas du tout ? champ qui refuse la saisie ?).

### Bugs / fixes

- Focus manquant sur le champ de saisie d'adresse Google à l'ouverture du composant mobile de création d'activité (bouton "+") : le composant s'ouvre mais le clavier/focus ne se pose pas automatiquement dessus.

### Offline & données (non prioritaire)

- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible

### UI Desktop

- Adapter l'IHM pour desktop : carte à gauche, activités à droite ; barre des jours en haut. Décision : s'applique aussi au mobile en landscape. Inclut la grille multi-colonnes pour les activités sur grand écran (repoussée ici plutôt que traitée isolément : elle casserait la géométrie du drag and drop maison, calculs verticaux voisin-par-voisin).
- Vue calendrier (reporté, pas assez cadré)

### Carte

- Gérer le cas Asie : alternative à Google Maps (non prioritaire)
- Carte pliée par défaut dans "Général" qui permet de voir toutes les activités du voyage. Même scroll que pour un day ?
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)
- Version "mieux" (reportée) de la fermeture de carte pendant modification : faire passer TOUTE l'édition d'activité par un dialog qui recouvre l'écran sur smartphone (comme les composants mobiles existants pour la plupart des champs), plutôt que le formulaire inline actuel — bloqué par l'absence d'équivalent dialog pour le textarea (notes) et la zone prix, tout le reste a déjà un composant mobile dédié

### Activités

- Vue vidéo avec animation qui parcourt le voyage (non prioritaire)
- Bouton "œil" pour visu avec animation vue macro (non prioritaire)
- Suggestions d'activités via la ville dans le pool (non prioritaire)
- Calcul auto des trajets entre activités (à pied / voiture / vélo) (non prioritaire — visuel de référence à challenger si le calcul temps réel s'avère trop lent : `public/distance entre activités.png`)
- Widget simplifié : saisie d'un horaire plutôt que des objet dates simplifiérait l'objet et le stockage mais ne doit rien changer pour le user
- il faut prévoir d'afficher l'activité sur le jour d'après si elle dure plusieurs jour
- Cohabitation entre le drag-and-drop libre (réorganisation manuelle des activités d'un jour) et un mode "par horaires" (tri automatique selon l'heure saisie) : pas de solution élégante trouvée pour gérer les deux sans réglage explicite — philosophie du produit : simplicité, pas de paramétrage, doit rester intuitif par défaut. À détailler via une question UX concrète avant d'implémenter (voir `.claude/skills/nesttrip-roadmap/SKILL.md`).

### Nouveau voyage / IA (non prioritaire)

- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera
- Proposer une amélioration d'itinéraire par jour. Je ne sais pas comment le matérialiser, mais ça permettrait de modifier l'ordre des activité, en prenant compte les horaires d'ouverture et les distances (IA)

### I18n (non prioritaire)

- Internationalisation de l'app (textes)
- Gestion de la devise par défaut en fonction de la position géographique

### Collaborateurs (non prioritaire)

- Email quand ajouté à un trip

### Devise

- Compteur de somme de tous les éléments à mettre dans l'onglet générale, je ne sais pas encore où (reporté, voir plan d'exécution en tête de fichier)

### UX / Interactions

- paramétrer la récup des infos du trafic d'avion
- en création d'une réservation, il faudrait fiare la même chose que pour la création d'une actuivité, c'est à dire basculer entre toutes les zones du formulaire

- Depuis les listes qui sont affichés en mode mobile, rajouter le titre ppour le chainage 

### Bugs / fixes

- Depuis le pool, problème de drag and drop maison : si je prend une activité qui est sous le calendrier, le calendrier s'ouvre et la position du drag est mal reconnue à l'affichage car si on est sur un jour, il faut sortir du calendrier et revenir pour que le survol fonctionne.
- mettre la même annimation sur cddrag que le drag and drop maison sur les cartes qui se déplacent de haut en bas quand on déplace par dessus en mode handle
- l'ouverture du calendrier sur le drag and drop dans la vue jour fait un petit sautement, il s'agrandit puis rerétraicit, il faut pas qu'il s'agrandisse plus que sa taille finale !
- Une fois le drag and drop fait, remettre le scroll sur l'activité drop
- Saisir date : mettre une annimation sur les aiguilles qui tourne entre les heure et les minutes
- Vue "lieux" (tri par ville, fusion des doublons de même placeId — onglet Activités) : ne pas afficher la couleur de statut de réservation ni le pictogramme trombone sur une carte qui représente plusieurs activités fusionnées — n'a pas de sens sur un agrégat.
- Clignotement des photos d'activité : l'image précédente s'affiche brièvement avant la nouvelle.
- Bouton flottant d'ajout : ne doit pas rester positionné au-dessus du clavier mobile quand celui-ci est ouvert.
- Pull-to-refresh sur l'écran swiper : toujours cassé malgré le correctif `overscroll-behavior`/`overflow` déjà tenté (voir "Déjà fait") — diagnostic : le scroll du haut est intercepté par Swiper avant d'atteindre le pull-to-refresh natif.

### Qualité / process

- Améliorer le .ico (manifest + png) : depuis un téléphone, "exporter comme application" (PWA) génère une icône floue. Il faut un vrai jeu d'icônes + manifest. Mis de côté pour l'instant, le logo pouvant encore changer.
- Tests e2e (Playwright) : socle en place le 2026-07-28 (compte de test Firebase Auth dédié, `npm run e2e`) — parcours 1 (login) et 2 (création de trip) couverts, parcours 3 à 7 (activité, form jour, dispatch, réservation, suppression) en backlog, voir `.claude/skills/nesttrip-e2e/SKILL.md`.
- empacter le tout dasn une application pour mobile ? Comment gérer la cohabitation ? — **en pause** : décision d'architecture (Capacitor ? store ?) à prendre avec l'utilisateur avant de commencer, pas lancé dans ce lot.

## ✅ Déjà fait

- Suppression multi-sélection unifiée (activités, réservations, notes, accueil-trip) : long-press + drawer sur mobile, checkbox toujours visible sur PC, `SelectionModeService` transverse + `TripItemDeletionService`
- Skeleton loading
- Refacto du style vers PrimeNG (composants + usage cohérent)
- Multiupload de fichiers
- Suppression de l'espacement clé/valeur dans les grids
- Déplacement automatique sur le bon jour
- Champs activité : horaires d'ouverture, carte (adresse), trajet, heure début/fin, type, prix, couleur d'état ("à réserver", "réservé", "pas besoin de réserver")
- Correction lien fichier + lien adresse maps
- Suppression du padding latéral des panel content
- Timeline cliquable vers Activités, sous forme de grid
- Un seul slot d'activités (fusion des slots multiples)
- Modification on input avec debounce 5s pour la mise à jour
- Format de date dans le storage header
- Navigation par jour selon date du jour / dernier jour ouvert (cookie)
- Note en début de page
- Nouveau style carte "activité" (2 lignes, photo Google Photos)
- Drag and drop des activités
- Popup de suppression réservée (accès restreint)
- Header modifiable et stylé (infos voyage)
- Menu de sélection/création de voyages
- Swipe gauche/droite entre les jours
- IA pour pré-remplir les infos à la saisie du titre
- Carte de couleur différente si réservation nécessaire
- Style responsive : login, popup, activités
- Toggle activité par défaut, nettoyage affichage (min, à réserver, heure)
- Calendrier pour modifier les dates début/fin du voyage (avec alerte si suppression de jours + proposition de décalage)
- Carte avec points d'activités du jour, cliquable vers l'activité dépliée
- Suppression d'un trip / d'une activité
- Réduction définition photos sur mobile
- Titre d'activité modifiable
- Déplacement d'activités entre jours via calendrier stylé (drag and drop qui se réduit + calendrier si pas de mouvement)
- Réservations transverses (hôtel/vol/location/autre) : sous-menu dédié (CRUD complet), bannière contextuelle read-only dans les jours (check-in/check-out, départ/arrivée, prise en charge/restitution), statut de vol temps réel via AeroDataBox avec rafraîchissement automatique intelligent (voir Reservation.md — nécessite de provisionner le secret `AERODATABOX_API_KEY` avant déploiement, pas encore testé sur de vrais vols)
- Autocomplete ville + nom de voyage ("Voyage à…")
- Suppression du mode lecture
- Clavier masqué quand le sélecteur est ouvert
- Swiper.js pour le slide
- Heure début/fin sur activités
- ID de day dans l'URL
- Fix slide mobile
- Vue "choix de la date" uniquement dans trip détail
- Animation toggle ralentie au drag, pop à la sélection, clavier qui ne s'ouvre plus
- Fix retour à l'écran de sélection après suppression de dates
- Fix lazy loading au retour sur un élément
- Fix couleur blanche résiduelle sur activeday au scroll
- Split ActivityCard (technique)
- Split infos (technique)
- Carrousel réduit par défaut après usage répété, form resserré, boutons/panels réduits
- Synchro carte/scroll au déplacement sur la carte
- Clic sur activité centre la carte
- Clic extérieur ferme tout ; heure début/fin harmonisées
- Logos remplacés par pi-chevron
- Bouton "tout supprimer" en footer
- Drag and drop désactive le slide
- Planificateur : liste d'activités à dispatcher sur les jours, triée
- Onglet "Général" : activités générales groupées par ville (ou "pas de lieu")
- Onglet "Notes" avec logo en top
- Onglet "Administratif" (hôtels, etc.) via boutons
- Overshoot avec vélocité au retour du drag and drop
- Onglets déplacés en bas (UI)
- Rappel couleur sur réservation
- Composant carte unique avec points injectés (prix des accès)
- Mode vecteur activé sur Google Maps
- Optimisation Maps : composant unique
- Optimisation appels Places (lazy avis, uniquement ceux manquants)
- Vue initiale centrée sur les 3 points en arrivant sur la carte
- Clavier masqué sur les datepickers
- Instance unique de la carte (post-portal)
- Animation swipe droite/retour au clic sur un élément de liste
- Date picker readonly dédié mobile
- Fix centrage carte sur scroll (au lieu du bouton 1)
- Time picker custom façon Google
- Suppression de trip limitée aux créateurs
- Fix rafraîchissement liste collaborateurs après invitation
- Fix drag and drop des notes
- Filtres "assigné / non assigné" en plus de "par ville"
- Changement du picto note (activité globale)
- Fix scroll carte
- Bouton flottant d'ajout
- "Google" au lieu de "GOOGLE"
- "Ajouter un voyage" (libellé)
- Collapse des activités sur l'écran pool
- p-panel → p-card pour notes et activités
- Chiffrement des fichiers stockés
- Réduction vitesse de scroll
- Variables d'environnement injectées et sorties du repo
- Fermeture de tous les composants ouverts au scroll du swipe
- Adaptation taille des jours (prend tout si inférieur)
- Hôtels/vols dans Général + liste complète
- Fix drag and drop activité cassé
- Complétion automatique de l'heure à la sélection
- Fix décalage "NestTrip" à cause de la flèche
- Fix rechargement de page lors de la modif d'une activity card
- Activités réelles au niveau des days (form indépendant par jour) + version "light" dans le pool, fichiers centralisés sur l'activité de pool : une même activité peut être placée sur plusieurs jours
- Login en `dvh` (prend en compte la barre Google)
- Lorsque je drag and drop les activités, certaine se mettent avec des heure de début et de fin non renseigné (le bon cas ), d'autre s'alimente avec l'heure actuelle, ce n'est pas bien !
- Vue d'ensemble avec zoom adapté pour voirs tous les point d'un jour quand on arrive sur un jour. Ensuite, lorsqeu l'on scroll juqu'à l'activité 1, il fautr que le zoom se positionne sur le jour 1, exactement comme la carte est aujourduit. Une fois arrivé à la, le zoom déjà en place par rapport au scrolling sera en place et tout fonctionnera.
- Je veux améliorer le zoom au scroll : il faudrait accélerer entre 2 point ert ralentir quand on est proche d'un point, là la trajectoir est linéaire
- Liste générale : rajouter l'info du/des jour(s) si l'activité est assignée (elle peut maintenant l'être sur plusieurs jours à la fois), mettre la mention "À assigner" sinon avec un truc visuel, une couleur.
- Hauteur de la carte Google en % d'écran plutôt qu'en pixels
- Taille minimum dynamique sur les fenêtres swipe
- Slide : repenser le slide: metttre le slide directement dans chaque slider, comme ça, en allant au jour suivant le slide d'un élément n'est pas pollué par le slide précédant. Par contre, il faut une facon élégante de masquer le header fixe + le header de voyage en scollant vers le bas. On pourrait faire du ménage sur le calcul du window.scrollY sur le body, et il faut faire très attention au slide qui est calculé sur chaque slider pour caler les activités à la carte. Attention aussi à ne pas afficher le slider dans le slide je ne veux pas plusieurs assenseurs. Cela simplifiera peut etre aussi le sticky sur la carte qui était compliqué à réaliser.
- Le changement de type sur une activité ne fonctionne plus !
- Barre du bas incohérente ("Général") lors du drag and drop d'activités : la bar est recréé dasn el composant de drag and drop mais elle est uniquement bien simulé dasn l'onglet Général, on ne pourrait pas faire un clone du visuelle comme pour le drag and drop que tu as mis ? Comme ça si il y a des changements futur, pas besoin de faire de correctif
- Le drag and drop fonctionne pas sur mobile, il s'annule dès que je drag :le redémarrage de serveur avait pourtant corrigé ce beug en serveur local
- Navbar : chiffre du jour en gros, mois complet en plus petit en dessous. Il serait bien d'avoir le jour de la semaine aussi; et de l'élargir un peut car sur les portables, si il y a la bar de multitache qui passe par dessus ça fait fin. Enfin, adapter la taille des jour si il y en as pas beaucoup pour qu'il prennent toute la place. peut être faire un custom plutôt ? avec le thème primeux attention
- Fix : sélection décalée vers le haut si un panel se réduit pendant le drag custom
- Si on ajoute des activités sur le pool, l'ordre ne doit pas changer.
- au niveau du slide de la carte, il faudrait calculer la hauteur à prendre en fonction de la distance à parcourir : plus il y a de distance, plus il faut reculer. Moins il y en a, moins il faut reculer
- Pouvoir supprimer des collaborateurs (via un clique sur les pastilles affiché:  ouvre la popup d'ajout des collob modifié qui permet la gestion des collab associés à ce trip, l'ajout d'un nouveau collab, la selection d'un companion de route à ajouter en clique rapide depuis une liste, la suppression d'un collab de route via une croix. Il faut donc stocker la liste des companions de route sur l'utilisateur, ou ? nouvelle bdd user ? => dans firestore ? Ca pourra servire pour le stockage des reglages du user. faut faire attention à la gestion des user, seul l'owner peut supprimer des membres, et il ne peut pas se supprimer lui même et doit supprimer le voyage, information à donner si son nom est grisé. Parti du dialog existant au clique sur "add collaborator". On pourrait supprimer le bouton "add colaborator" car le cluque sur la pastille remplacerai ça ?
- Et sortir le p-dialog pour le mettre dasn un composant à part, transverse comme ça sa taille n'est pas limité au composant
- Ouvrir le calendrier en dialog si écran taille smartphone
- Tooltip propriétaire à repositionner sur la suppression des activité car il est parfois mal positionné et un top, bottom ne regle pas 100% des cas
- Zones de drag and drop plus larges que les logos (réduire les mis-clics)
- p-drawer mobile-only pour le mode modification de listes (desktop garde le fonctionnement actuel)
- Crayon pour modifier le titre pour pouvoir mettre le clique sur tout le header pour le déplier
- Lorsque je choisi une activité dans le pool via la bar, les infos googles ne sont pas rensiegnés. Au deuxième clique, là ça marche. A corriger pour que ça marche du premier coup
- La zone de saisie pour le prix n'est pas bonne
- L'ajout des activité dans le pool ne chaine pas sur la saisie du titre
- Si j'ajoute un titre à une activité dans le p-autocomplete, la valeur du titre est bien mit à jour mais les données de google ne sont pas ramené, alors que la deuxième fois si
- Bouton flottant d'ajout avec scroll auto vers la nouvelle activité créée et le curseur positionné sur le choix de l'activité
- Uniformiser les pratique entre flouter et mettre en plus sombre quand il y a un modal
- Afficher la carte seulement si pas d'activité ou activités incomplètes
- Problème theme : skeleton bleu en dark mode, chip des pieces en thème dark sont en couleur claire, le contour de app overlay n'est pas la bonne couleur ni en dark ni en light
- Image : suppression du bloc image, l'ouverture des images doit se faire via le clique sur l'image miniature → embla-carousel en p-dialog sur toute la page
- Onglet Activités : tri par ville (avec fusion des doublons de même placeId, dates combinées) ou chronologique (jour par jour, "à assigner" en haut, jamais fusionné), barre de recherche, clic sur une date pour sauter au jour + scroller vers l'activité
- Durée : autre méthode de saisie, gestion des durées > 24h si on a plusieurs jour plusieurs jours
- Inciter l'utilisateur à compléter les données d'une carte/activité transport/hébergement en ouvrant l'élément à modifier suivant à la création d'une activité ? Ca ferai comme un pipe ou il chaine sur les 2-3 infos, pas trop relou en terme d'ux ?
- Modifier le système de saisie des horaire sur ordi pour faire 2 zones de saisie number : pas d'ouverture du composant
- Modifier le composant timepicker pour permettre la saisie sur clavier comme sur le composant google !
- Dans la modification de l'heure, si l'utilisateur positionne une heure puis une minute, alors il faut faire ok
- Si j'ai qu'un seul trip, je ne peux plus faire retour sur la première page, donc je ne peux pas créer de trip. C'est à la connexion qu'il faut aller sur le trip, pas tout le temps
- style zones saisie sur ordi + taille durée qui n'est pas bon quand on est pas en mode horloge (trop haut) + durée tu as fais du spécifique ? Il faudrait pas et réutiliser le même composant. min-height: 16.5rem; à enlever quand pas horloge
- Saisir duré : faire le focus sur l'heure
- Warnings de dépréciation Google Maps (`PinElement.element`, `click` → `gmp-click`)
- Couleur de la barre de drag&drop maison : sélecteur CSS `.p-panel` obsolète (mort depuis la sortie de PrimeNG) remplacé par `.booking`
- Bouton flottant trop près du bord (marge + `safe-area-inset-right`) + animation d'ouverture ralentie
- `min-width: 24rem` remonté au niveau `html`/`body` : protège aussi les éléments passés en `position: fixed` (le swiper), que le `min-width` local de `.app-content` ne couvrait plus
- Statut ouvert/fermé Google basé sur l'heure de début de l'activité, plus l'heure de consultation
- Thème clair/sombre/système : `ThemeService`, bouton segmenté 3 icônes (même style qu'Activités/Réservations/Notes) dans le menu réglages, avec le libellé "Thème" ; carte Google Maps recréée à chaque bascule pour un rendu correct (`colorScheme` ne se rafraîchit pas visuellement via `setOptions()` sur une carte déjà créée) ; `color-scheme` posé explicitement sur `:root[data-theme]` pour que `light-dark()` (classes utilitaires) suive le thème choisi
- Max-width centré sur les colonnes jour/général en grand écran (`--nt-content-max-width`)
- Logo pièce jointe dans le header d'activité si des fichiers sont associés
- Largeur max du tab de login sur PC
- Indicateur discret de sauvegarde : fine barre qui glisse de gauche à droite (verte si succès, rouge en boucle si échec), sans texte
- État de l'onglet Général (`?tab=`) et du tri Activités (`?sort=`) dans l'URL, restaurés au montage
- Catégorisation en cours/future/passée des réservations : passées grisées avec contour en pointillés (comme les activités non placées), tri désormais 100% automatique (glisser-déposer manuel retiré)
- Devise par défaut par voyage : sélecteur dans le header, préremplit les nouvelles activités/réservations (jamais rétroactif sur l'existant)
- Fix : le tri chronologique de l'onglet Activités affichait le formulaire d'édition à tort
- Fix : tenir appuyé sur la poignée de drag and drop (ou démarrer un drag) déclenchait le mode sélection à tort
- Fix : icônes du sélecteur (ex. thème) mal centrées quand un bouton n'a pas de label
- Clic n'importe où dans le header (pas seulement le bouton bascule) pour replier/déplier une carte (activités, notes, réservations, panneaux jour...), sauf sur une zone interactive (poignée de drag, image, bouton crayon, checkbox) — générique au niveau de `PanelComponent`, accessible au clavier (tabindex + Entrée/Espace)
- Redirection directe vers l'unique trip à l'ouverture de la web app (login interactif ET session déjà authentifiée restaurée au démarrage), jamais lors d'un retour manuel depuis un trip — flag `AuthService.justLoggedIn` initialisé à `true` à la construction du service (une seule fois par chargement de page), consommé une fois par `AccueilTripComponent`
- Tiroir mobile de `SelectComponent` : titre de la liste au lieu d'un input de recherche (voir régression du 2026-07-29 corrigée plus bas — les listes concernées sont toutes courtes, la recherche n'apportait rien)
- Préremplir le titre de la nouvelle activité avec le texte déjà tapé dans la barre de recherche
- Barre Activités/Réservations/Notes flottante en bas d'écran, au-dessus de la barre des jours, uniquement sur mobile (remplace la bascule inline en haut, cachée en dessous de 768px) — reste visible pendant le scroll sans avoir à remonter en haut de la liste
- Max-width sur les textarea de titre inline (titre du voyage, titres/points de notes) : sur grand écran ils s'étiraient sur toute la largeur de la colonne, rendant l'espace vide à droite du texte cliquable/focusable à tort (`.nt-capped-inline-field`)
- Carte épinglée (sticky) au-dessus de la liste d'activités du jour : ajout d'une ombre portée pour séparer visuellement la carte du contenu qui défile dessous, qui donnait l'impression d'un bug d'empilement
- Carte repliée automatiquement pendant l'édition d'une activité, mobile uniquement (verrou réentrant `GoogleMapPanelService.beginEditLock/endEditLock`, plusieurs cartes peuvent être en édition en même temps)
- Saisie clavier des dates dans `app-date-picker`, desktop uniquement : le trigger devient un vrai champ texte (`dd/MM/yyyy`, ou `dd/MM/yyyy - dd/MM/yyyy` en mode plage) à côté d'un bouton icône séparé pour ouvrir le calendrier — mobile inchangé (bouton seul)
- Infrastructure de travail autonome : 4 skills projet (`nesttrip-roadmap`, `nesttrip-verify`, `nesttrip-testing`, `nesttrip-e2e`), section "Workflow" dans `CLAUDE.md`, premiers tests unitaires réels (Vitest — mappers + `TripStore` avec ses services de persistence stubbés, anti-flicker `_pendingActivityIds` couvert), et socle e2e Playwright (compte de test dédié, parcours login + création de trip couverts)
- Tous les composants passés en `ChangeDetectionStrategy.OnPush` : 3 `ControlValueAccessor` corrigés au passage (InputNumber, Password, TimePickerDialog — état en signal plutôt qu'en champ simple, `writeValue()`/`setDisabledState()` étant appelés depuis l'extérieur du template) ; `provideZonelessChangeDetection()` ajouté explicitement (l'app tournait déjà sans `zone.js`, en fallback implicite) et 3 usages `NgZone` devenus des no-ops nettoyés
- SCSS custom dupliquant une classe PrimeFlex existante basculé vers ces classes utilitaires (triage fichier par fichier, uniquement quand la valeur est strictement identique et sans redéfinition locale en conflit) puis suppression complète de la dépendance PrimeFlex : sous-ensemble réellement utilisé dupliqué dans `src/styles/layout-utilities.scss` (portage 1:1, mêmes noms/valeurs), shim `--p-*` de `tokens.scss` supprimé
- Montée Angular 22 (+ `@angular/cdk`, `@angular/google-maps`, `angular-eslint`, TypeScript 6) : `ng update` en un seul passage, migration automatique (`withXhr()` sur `provideHttpClient`), dernier `@ViewChild` décorateur converti en `viewChild()` signal
- Secret de déploiement pour la release — **en pause** : nécessite une valeur/action manuelle de l'utilisateur (créer le secret côté hébergeur/CI), pas actionnable par le développement seul.
- **Régressions post-migration OnPush/PrimeFlex/Angular 22 (remontées le 2026-07-29)** :
  - Cause racine du "drag and drop qui plante" (desktop) : `activityToFb` (mapper d'une activité de pool) spreadait l'objet domaine tel quel, laissant passer `address`/`latitude`/`longitude` à `undefined` pour une activité sans lieu Google (ex. saisie en texte libre) — Firestore rejette toute écriture contenant un champ `undefined` (`updateDoc`/`setDoc` lèvent une exception non rattrapée), retentée indéfiniment toutes les 3s par `DebounceWriter` (voir `debounced-writer.ts`). Corrigé à l'endroit prévu pour ça : `activityToFb`/`tripToFb` omettent maintenant les champs optionnels absents plutôt que de les écrire à `undefined`, même règle déjà appliquée par `reservationToFb` (voir sa doc) — `ignoreUndefinedProperties: true` gardé sur l'instance Firestore (`FirebaseService`) en filet de sécurité, mais le mapper reste la source de vérité pour la propreté des données
  - **Gel total au clic sur un jour en mode mobile** (confirmé par l'utilisateur comme antérieur à la migration, pas la même cause que le point Firestore ci-dessus) : `ActivityCardComponent` a un `effect()` qui replie la carte Google pendant l'édition d'une activité sur mobile (`GoogleMapPanelService.beginEditLock/endEditLock`, verrou réentrant car jusqu'à 3 `DayPanelComponent` coexistent — préchargement des jours voisins par `TripDaySwiperComponent`). Cet effect rappelait `beginEditLock`/`endEditLock` à CHAQUE réévaluation de ses dépendances (`inDayList()`, `viewport.isMobile()`, `collapsed()`), pas seulement quand le verrou devait réellement changer d'état — sur un jour avec au moins une activité, un changement de viewport (redimensionnement, ou ouverture du jour sur mobile) déclenchait une cascade d'allers-retours coûteux (déplacement DOM de la carte + resize Google Maps) qui gelait le thread principal. Reproduit et confirmé de façon fiable via Playwright (`page.setViewportSize` sur une page avec ≥1 activité sur le jour affiché) avant correctif, taille réduite quasi instantanée après. Fix : l'effect ne rappelle plus le service que si l'état verrouillé/déverrouillé change réellement (`isEditLocked` comparé avant d'agir). Garde-fous ajoutés en complément (arrêt + diagnostic console si une boucle `requestAnimationFrame` tourne anormalement longtemps sans jamais atteindre l'idle) dans `DayScrollSyncService`/`TripDaySwiperComponent`, qui n'étaient pas la cause ici mais restent une protection utile
  - Vue "chronologie" du pool d'activités : le message "Aucune activité pour l'instant" ne s'affiche plus en bas de liste (redondant avec la catégorisation par jour, déjà visible même vide)
  - Devise par défaut du trip : signal dédié (`TripStore._tripCurrency` / `TripFacade.getTripCurrency`), la modifier ne met plus à jour `_trips` (qui faisait recalculer `activeTrip`, lu par énormément de composants, et rafraîchissait tout l'écran à chaque changement)
  - Heure de fin/minutes d'une activité (et check-in/check-out d'une réservation, même composant `app-time-picker-dialog`) renseignées à tort avec l'heure/minute actuelles lors d'une saisie clavier partielle (desktop) : le champ retombait sur `new Date()` (l'instant de la frappe) au lieu d'une base neutre 00:00 quand aucune heure n'était encore saisie
  - "Fermé" affiché à tort sur un établissement ouvert 24h/24 (`ActivityGoogleInfoComponent.isOpenNow` ne reconnaissait pas la mention "24h/24", faute de plage horaire `hh:mm–hh:mm` à parser) ; bloc "Horaires d'ouverture" masqué quand la liste est vide plutôt qu'affiché sans contenu
  - Texte barré des notes (`.line-through`) : classe utilitaire oubliée lors du portage du sous-ensemble PrimeFlex vers `layout-utilities.scss`
  - Zone de saisie des dates du jour/voyage (`app-date-picker`, desktop) tronquée depuis le passage de l'année à 4 chiffres : largeur mini en `ch` dimensionnée pour le format le plus long (`dd/MM/yyyy` ou plage complète), `flex:1` (flex-basis 0) ignorait sinon la taille du contenu dans un host `width:max-content`
  - Bouton flottant "Ajouter" qui passait par-dessus le bouton "Notes" de la barre de bascule mobile (Général) : sa hauteur (`TripChromeService.generalSubTabBarHeight()`) n'était pas prise en compte dans le décalage bas du bouton, seule la barre des jours l'était
  - Barre du mode sélection ("Annuler"/"Supprimer") plus petite que la barre des jours qu'elle doit recouvrir entièrement : hauteur mini alignée sur `TripChromeService.tabsNavHeight()`
  - Carte du jour : le clic sur un marqueur ne recentrait/scrollait plus vers l'activité correspondante — `gmpClickable` non activé sur les markers avancés dont l'écouteur `gmp-click` est posé à la main (`addEventListener`, pas le helper `addListener` historique qui l'activait implicitement) : le marker restait visuellement affiché mais insensible aux clics réels