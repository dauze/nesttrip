# NestTrip — Roadmap

Ce document sert de référence pour le projet : ce qui est déjà en place (à ne pas casser) et ce qu'il reste à faire.

## ✅ Déjà fait

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


## 🔧 À faire

### Offline & données (non prioritaire)
- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible

### UI Desktop
- Adapter l'IHM pour desktop : carte à gauche, activités à droite ; barre des jours en haut
- Vue calendrier ?
- Ouvrir le calendrier en dialog si écran taille smartphone

### Carte
- Gérer le cas Asie : alternative à Google Maps (non prioritaire)
- Afficher la carte seulement si pas d'activité ou activités incomplètes
- Carte pliée par défaut dans "Général" (aperçu + "voir plus" → bon jour)
- Mode sombre/clair dynamique sur la carte, ça fonctionne pas si je change le thème de chromme sans réactialiser Le bouton doit être dans le menu des séting en mode une lune, un soleuil et un apparail via un bouton en 3 parties
- Rajouter la Position actuelle de l'utilisateur sur la carte
- Fermer la carte pendant la modification d'une activité : ou mieux ! Quand on est en modification d'une activité, toute modification passe par un dialog qui passe au dessus, c'est plus propre pour de l'ui sur smartphone. Attention, il faut que le faire pour les smartphones,pour les ordi, pas besoin.
- Rendre visuellement clair que la carte superposée n'est pas un bug : le visu est actuellement étrange

### Activités
- Vue vidéo avec animation qui parcourt le voyage (non prioritaire)
- Bouton "œil" pour visu avec animation vue macro (non prioritaire)
- Suggestions d'activités via la ville dans le pool (non prioritaire)
- Tri par ville et par jour dans l'onglet activités, non assignées en bas
- Calcul auto des trajets entre activités (à pied / voiture / vélo)
- Widget simplifié : saisie d'un horaire plutôt que des objet dates simplifiérait l'objet et le stockage mais ne doit rien changer pour le user
- Durée : autre méthode de saisie, gestion des durées > 24h si on a plusieurs jour plusieurs jours ! et il faut prévoir d'afficher l'activité sur le jour d'après si elle dure plusieurs jour
- Inciter l'utilisateur à compléter les données d'une carte/activité transport/hébergement en ouvrant l'élément à modifier suivant à la création d'une activité ? Ca ferai comme un pipe ou il chaine sur les 2-3 infos, pas trop relou en terme d'ux ? 

### Nouveau voyage / IA (non prioritaire)
- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera
- Proposer une amélioration d'itinéraire par jour. Je ne sais pas comment le matérialiser, mais ça permettrait de modifier l'ordre des activité, en prenant compte les horaires d'ouverture et les distances (IA)

### Collaborateurs
- Email quand ajouté à un trip  (non prioritaire)
- Pouvoir supprimer des collaborateurs (via un clique sur les pastilles affiché:  ouvre la popup d'ajout des collob modifié qui permet la gestion des collab associés à ce trip, l'ajout d'un nouveau collab, la selection d'un companion de route à ajouter en clique rapide depuis une liste, la suppression d'un collab de route via une croix. Il faut donc stocker la liste des companions de route sur l'utilisateur, ou ? nouvelle bdd user ? => dans firestore ? Ca pourra servire pour le stockage des reglages du user.  faut faire attention à la gestion des user, seul l'owner peut supprimer des membres, et  il ne peut pas se supprimer lui même et doit supprimer le voyage, information à donner si son nom est grisé. Parti du dialog existant au clique sur "add collaborator". On pourrait supprimer le bouton "add colaborator" car le cluque sur la pastille remplacerai ça ? 

### Administratif
- Onglet dédié : vols, hébergements, trains, location de voiture : composant à définir 
- Dates début/fin pour hébergements, catégorisation "en cours" / "future" / "passée" (grisée en bas si date renseignée, sinon non catégorisé)

### Devise
- Sélection de la devise par voyage (valeur par défaut)
- Compteur de somme de tous les éléments à mettre dan l'onglet générale, je ne sais pas encore ou 

### UX / Interactions
- Suppression : passer en "rester appuyé" plutôt qu'icône corbeille toujours visible : on pourrait mettre des checkbox qui apparaissent pour supprimer en masse par exemple. le clique long est une idée ux améliorable car il y a pleins de trucs sur mon header
- mettre un petit logo piece jointe dans le header d'une activité si il y a des fichiers associés 
- Couleur différente sur texte modifiable : à voir car faudrait l'appliquer sur les dates, les listes, et touts element modifiable, pas juste les input. Pour les couleurs, un truc proche de la couleur de base
- Crayon pour modifier le titre pour pouvoir mettre le clique sur tout le header pour le déplier 
- Image : suppression du bloc image, l'ouverture des images doit se faire via le clique sur l'image miniature  → embla-carousel en p-dialog sur toute la page
- Si un seul trip, y aller directement et pas afficher la page de liste des trips : attention, j'ai désactivé ta modif car si on a qu'un seul trip, alors on peut pas retourner sur l'écrna d'accueil. Il faudrait que ce soit à l'ouverture de la web app uniquement, si l'utilisateur clique sur retour il peut aller sur l'accueil
- Navbar : chiffre du jour en gros, mois complet en plus petit en dessous. Il serait bien d'avoir le jour de la semaine aussi; et de l'élargir un peut car sur les portables, si il y a la bar de multitache qui passe par dessus ça fait fin. Enfin, adapter la taille des jour si il y en as pas beaucoup pour qu'il prennent toute la place. peut être faire un custom plutôt ? avec le thème primeux attention
- Bouton flottant d'ajout avec scroll auto vers la nouvelle activité créée et le curseur positionné sur le choix de l'activité
- Tooltip propriétaire à repositionner sur la suppression des activité car il est parfois mal positionné et un top, bottom ne regle pas 100% des cas 
- Bar "Activités - Notes" en sticky en bas au slide, au dessus de la bar des jours. Nécessite de calculer la hauteur exacte du slide (soustraire les hauteurs de tous les autres éléments) pour positionner correctement cette barre sticky.
- Drag and drop maison : agrandir la zone de décalage, vérifier si cdkDrag le propose, uniformiser le comportement entre tous les drags
- Fix : sélection décalée vers le haut si un panel se réduit pendant le drag custom
- Zones de drag and drop plus larges que les logos (réduire les mis-clics)
- p-drawer mobile-only pour le mode modification de listes (desktop garde le fonctionnement actuel)
- Si on ajoute des activités sur le pool, l'ordre ne doit pas changer.
- Lorsque je choisi une activité dans le pool via la bar, les infos googles ne sont pas rensiegnés. Au deuxième clique, là ça marche. A corriger pour que ça marche du premier coup

- Ajouter dans l'url si on est dans l'onglet notes ou Activités pour pouvoir actualiser sans perdre la position
- au niveau du slide de la carte, il faudrait calculer la hauteur à prendre en fonction de la distance à parcourir : plus il y a de distance, plus il faut reculer. Moins il y en a, moins il faut reculer
- Mettre la carte sur le côté lorsque le téléphone est en mode allongé 
- Uniformiser les pratique entre flouter et mettre en plus sombre quand il y a un modal


### Bugs / fixes
- Barre du bas incohérente ("Général") lors du drag and drop d'activités : la bar est recréé dasn el composant de drag and drop mais elle est uniquement bien simulé dasn l'onglet Général, on ne pourrait pas faire un clone du visuelle comme pour le drag and drop que tu as mis ? Comme ça si il y a des changements futur, pas besoin de faire de correctif
- Depuis le pool, sélection d'une activité sous le calendrier : position mal reconnue à l'affichage car si on est sur un jour, il faut sortir du calendrier et revenir pour que le survol fonctionne.
- Si j'ai qu'un seul trip, je ne peux plus faire retour sur la première page, donc je ne peux pas créer de trip. C'est à la connexion qu'il faut aller sur le trip, pas tout le temps 
- mettre la même annimation sur cddrag que le drag and drop maison sur les cartes qui se déplacent de haut en bas quand on déplace par dessus en mode handle
- Le drag and drop fonctionne pas sur mobile, il s'annule dès que je drag :le redémarrage de serveur avait pourtant corrigé ce beug en serveur local
- Si j'ajoute un titre à une activité dans le p-autocomplete, la valeur du titre est bien mit à jour mais les données de google ne sont pas ramené, alors que la deuxième fois si
- Dans la modification de l'heure, si l'utilisateur positionne une heure puis une minute, alors il faut faire ok
### Qualité / process
- Améliorer le .ico (manifest + png) : depuis un téléphone, "exporter comme application" (PWA) génère une icône floue. Il faut un vrai jeu d'icônes + manifest. Mis de côté pour l'instant, le logo pouvant encore changer.
- Tests e2e avec Claude (skills, agents, bonnes pratiques)
- Secret de déploiement pour la release
- Menu : mode sombre / clair / système
- Faire un gros travail de code review pour uniformiser les pratiques (exemple les oninit alors qu'on est en angular 21), supprimer le code mort, déplacer dans des services des comportement isolé sur certain fichiers trop gros, séparer les trop gros fichier intelligement, eviter les view child plutôt privilégier les services pour partager des données (ce n'est pas tout le temps possible)
- Eviter de faire des input-output quand ce n'est pas des dub component et privilégier les services, sauf si ca génère de la complexité 
