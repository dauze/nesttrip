# NestTrip — Roadmap

Ce document sert de référence pour le projet : ce qui est déjà en place (à ne pas casser) et ce qu'il reste à faire.

## 📋 Plan d'exécution en cours (branche `claude/roadmap-planning-r5e7av`)

Objectif : traiter tout ce qui n'est pas marqué "non prioritaire" ci-dessous. Décisions prises avec l'utilisateur le 2026-07-28 :

- **Layout desktop (carte gauche / activités droite, jours en haut)** : s'applique aussi au mobile en position allongée (landscape), pas seulement au vrai desktop.
- **Vue calendrier** (UI Desktop) : reportée, pas assez spécifiée pour l'instant.
- **Compteur de somme devise** : reporté (un onglet dédié n'est pas voulu, le mettre dans le header prendrait trop de place — à retravailler plus tard).
- **Devise par défaut** : préremplissage des nouvelles saisies uniquement, jamais rétroactif sur les activités/réservations déjà créées.
- **Tri des réservations** : 100% automatique (chronologique, passées en bas) ; le glisser-déposer manuel a été retiré.

Items **mis en pause** (structurants, pas assez cadrés pour être lancés sans nouvelle discussion — voir section Qualité/process) : passage Angular 22, suppression de la dépendance PrimeFlex, empaquetage mobile (Capacitor ?), secret de déploiement (nécessite une valeur fournie par l'utilisateur), périmètre des tests e2e.

Ordre d'exécution prévu pour le reste :
1. **Bugs / fixes** liés au geste/à l'animation (drag&drop sous calendrier, animation cdkDrag, sursaut calendrier, scroll post-drop, aiguilles horaire) — **non vérifiés visuellement** : Google Maps/Fonts sont bloqués par la politique réseau de l'environnement d'exécution (proxy renvoie 403), donc `ng serve`/`ng build` n'y suffisent pas pour tester visuellement — à tester côté utilisateur.
2. **UX/Interactions** restantes (redirection single-trip, barre sticky, max-width des champs, préremplissages, saisie clavier calendrier).
3. **Carte** (carte pliée dans Général, fermeture carte pendant édition via dialog mobile, clarté visuelle carte superposée).
4. **Activités** (widget horaire simplifié, affichage multi-jours).
5. **UI Desktop / landscape** (redesign le plus large, fait en dernier).

Tout ce qui a déjà été livré (avec le détail des correctifs) est listé dans **✅ Déjà fait**, tout en bas.

## 🔧 À faire

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
- Fermer la carte pendant la modification d'une activité : ou mieux ! Quand on est en modification d'une activité, toute modification passe par un dialog qui passe au dessus, c'est plus propre pour de l'ui sur smartphone. Attention, il faut que le faire pour les smartphones, pour les ordi, pas besoin : pour ce point, il manque une solution pour les textarea et la zone prix, tout le reste passe par un composant mobile déjà
- Rendre visuellement clair que la carte superposée n'est pas un bug : le visu est actuellement étrange, même si le fonctionnement est parfaitement fonctionnel

### Activités

- Vue vidéo avec animation qui parcourt le voyage (non prioritaire)
- Bouton "œil" pour visu avec animation vue macro (non prioritaire)
- Suggestions d'activités via la ville dans le pool (non prioritaire)
- Calcul auto des trajets entre activités (à pied / voiture / vélo) (non prioritaire)
- Widget simplifié : saisie d'un horaire plutôt que des objet dates simplifiérait l'objet et le stockage mais ne doit rien changer pour le user
- il faut prévoir d'afficher l'activité sur le jour d'après si elle dure plusieurs jour

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

- Si un seul trip, y aller directement et pas afficher la page de liste des trips : attention, j'ai désactivé ta modif car si on a qu'un seul trip, alors on peut pas retourner sur l'écrna d'accueil. Il faudrait que ce soit à l'ouverture de la web app uniquement, si l'utilisateur clique sur retour il peut aller sur l'accueil
- Bar "Activités - Notes" en sticky en bas au slide, au dessus de la bar des jours uniquement sur mobile
- Modifier la taille des zones pour pas qu'elles prennent tout l'écran (donc mettre un max-width sur les lists, input) car c'est génant de cliquer à côté et que ça fasse la modification — colonnes jour/général déjà limitées (`--nt-content-max-width`), reste à traiter les champs de saisie eux-mêmes.
- reseigner en input le titre de la selection sur les listes lorsqu'elles s'ouvre sur mobile
- clique sur n'importe ou du header pour le collapse true/ false et pas que sur le bouton, sauf la zone de drag and drop, l'image ou le stylo. Idem pour les notes
- Quand on tape dan la bar de recherche une activité, si on clique sur ajouter, renseigner le titre avec le texte quia été tapé dans la bar de recherche
- Pour le calendrier, pouvoir saisir la date lorsque l'on est en vue ordinateur, donc pas que le calendrier masi aussi une zone de texte de date intelligente qui permette de le taper au clavier
- paramétrer la récup des infos du trafic d'avion

### Bugs / fixes

- Depuis le pool, problème de drag and drop maison : si je prend une activité qui est sous le calendrier, le calendrier s'ouvre et la position du drag est mal reconnue à l'affichage car si on est sur un jour, il faut sortir du calendrier et revenir pour que le survol fonctionne.
- mettre la même annimation sur cddrag que le drag and drop maison sur les cartes qui se déplacent de haut en bas quand on déplace par dessus en mode handle
- l'ouverture du calendrier sur le drag and drop dans la vue jour fait un petit sautement, il s'agrandit puis rerétraicit, il faut pas qu'il s'agrandisse plus que sa taille finale !
- Une fois le drag and drop fait, remettre le scroll sur l'activité drop
- Saisir date : mettre une annimation sur les aiguilles qui tourne entre les heure et les minutes

### Qualité / process

- Améliorer le .ico (manifest + png) : depuis un téléphone, "exporter comme application" (PWA) génère une icône floue. Il faut un vrai jeu d'icônes + manifest. Mis de côté pour l'instant, le logo pouvant encore changer.
- Tests e2e avec Claude (skills, agents, bonnes pratiques) — **en pause** : périmètre pas défini (quels parcours couvrir ?), à recadrer avant de lancer.
- Secret de déploiement pour la release — **en pause** : nécessite une valeur/action manuelle de l'utilisateur (créer le secret côté hébergeur/CI), pas actionnable par le développement seul.
- tout passer en strategy onpush
- passer à angular 22 — **en pause** : montée de version majeure, à valider (compat PrimeNG/PrimeFlex) avant de lancer pour éviter de casser l'existant en même temps que le reste du plan.
- basculer tous les scss possible via des scss primeflex — **en pause**, gros refacto transverse, à faire isolément.
- Duppliquer tout le code utiliser de primeflex et supprimer la librairie — **en pause**, dépend de l'item précédent.
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
- Thème clair/sombre/système : `ThemeService`, bouton segmenté 3 icônes (même style qu'Activités/Réservations/Notes) dans le menu réglages, avec le libellé "Thème" ; carte Google Maps recréée à chaque bascule pour un rendu correct (`colorScheme` ne se rafraîchit pas visuellement via `setOptions()` sur une carte déjà créée) ; `color-scheme` posé explicitement sur `:root[data-theme]` pour que `light-dark()` (primeflex) suive le thème choisi
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
- Pull-to-refresh sur l'écran swiper : `overscroll-behavior` + `overflow` html/body corrigés (non confirmé testé par l'utilisateur)
