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

## 🔧 À faire

### Offline & données
- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible

### UI Desktop
- Adapter l'IHM pour desktop : carte à gauche, activités à droite ; barre des jours en haut
- Vue calendrier ?
- Ouvrir le calendrier en dialog si écran taille smartphone

### Carte
- Gérer le cas Asie : alternative à Google Maps
- Afficher la carte seulement si pas d'activité ou activités incomplètes
- Carte pliée par défaut dans "Général" (aperçu + "voir plus" → bon jour)
- Mode sombre/clair dynamique sur la carte, ça fonctionne pas si je change le thème de chromme sans réactialiser
- Rajouter la Position actuelle de l'utilisateur sur la carte
- Vue d'ensemble avec zoom adapté pour voirs tous les point d'un jour quand on arrive sur un jour. Ensuite, lorsqeu l'on scroll juqu'à l'activité 1, il fautr que le zoom se positionne sur le jour 1, exactement comme la carte est aujourduit. Une fois arrivé à la, le zoom déjà en place par rapport au scrolling sera en place et tout fonctionnera.
- Je veux améliorer le zoom au scroll : il faudrait accélerer entre 2 point ert ralentir quand on est proche d'un point, là la trajectoir est linéaire
- Fermer la carte pendant la modification d'une activité : ou mieux ! Quand on est en modification d'une activité, toute modification passe par un dialog qui passe au dessus, c'est plus propre pour de l'ui sur smartphone. Attention, il faut que le faire pour les smartphones,pour les ordi, pas besoin.
- Rendre visuellement clair que la carte superposée n'est pas un bug : le visu est actuellement étrange
- Hauteur de la carte Google en % d'écran plutôt qu'en pixels

### Activités
- Vue vidéo avec animation qui parcourt le voyage
- Bouton "œil" pour visu avec animation vue macro
- Suggestions d'activités via la ville dans le pool
- Tri par ville et par jour dans l'onglet activités, non assignées en bas
- Liste générale : rajouter l'info de la date si elle est assignée, mettre la menstion "À assigner" sinon avec un  truc visuelle, une couleur. 
- Calcul auto des trajets entre activités (à pied / voiture / vélo)
- Widget simplifié : saisie d'un horaire plutôt que des objet dates siumplifiérait l'objet et le stockage
- Durée : autre méthode de saisie, gestion des durées > 24h si on a plusierus jour plusieurs jours ! et il faut prévoir d'afficher l'activité sur le jour d'après si elle dure plusieurs jour
- Limite actuelle : une activité ne peut être positionnée que sur un seul jour → remettre les vraies activités au niveau des days, mettre une version "light" dans le pool (sans le activity form). Comme ça, on peut mettre plkusieurs fois la même activité dans plusierus jour et chaque activité à ses propres valeurs du form. Seule exception, tout les fichiers doivent se retrouver sur l'activité du pool (pas de sync à faire, activités dupliquables avec données différentes)

### Nouveau voyage / IA
- Page "nouveau voyage" : appel IA pour pré-remplir jours/activités/période en fonction des choses à faire, si l'utilisateur propose des trucs, dis ce qu'il veut faire, excetera
- Proposer une amélioration d'itinéraire par jour. Je ne sais pas comment le matérialiser, mais ça permettrait de modifier l'ordre des activité, en prenant compte les horaires d'ouverture et les distances (IA)

### Collaborateurs
- Ajouter des compagnons de route
- Email quand ajouté à un trip
- Pouvoir supprimer des collaborateurs (via les pastilles affiché, ou un autre process pas encore défini : cliquer sur les colab ouvre la popup d'ajout des collob modifié qui permet la gestion des collab ?) faut faire attention à la gestion des user, seul l'owner peut supprimer des membres, et  il ne peut pas se supprimer lui même et doit supprimer le voyage, information à donner si son nom est grisé 

### Administratif
- Onglet dédié : vols, hébergements, trains, location de voiture
- Dates début/fin pour hébergements, catégorisation "en cours" / "future" / "passée" (grisée en bas si date renseignée, sinon non catégorisé)
- Inciter l'utilisateur à compléter les données d'une carte/activité transport/hébergement

### Devise
- Sélection de la devise par voyage (valeur par défaut)
- Compteur de somme de tous les éléments

### UX / Interactions
- Suppression : passer en "rester appuyé" plutôt qu'icône corbeille toujours visible
- Couleur différente sur texte modifiable
- Crayon pour modifier le titre
- Taille minimum dynamique sur les fenêtres swipe
- Image : suppression du bloc image, clic → embla-carousel en p-dialog flouté (photos)
- Slide : l'élément suivant doit démarrer en scroll top (ignorer le scroll de l'élément précédent)
- Si un seul trip, y aller directement
- Navbar : chiffre du jour en gros, mois complet en plus petit en dessous
- Bouton flottant d'ajout avec scroll auto vers la nouvelle activité créée
- Tooltip propriétaire à repositionner
- Bar "Activités - Notes" en sticky en bas au slide (comme la carte)
- Drag and drop maison : agrandir la zone de décalage, vérifier si cdkDrag le propose, uniformiser le comportement entre tous les drags
- Fix : sélection décalée vers le haut si un panel se réduit pendant le drag custom
- Zones de drag and drop plus larges que les logos (réduire les mis-clics)
- p-drawer mobile-only pour le mode modification de listes (desktop garde le fonctionnement actuel)
- Login en `dvh` (prend en compte la barre Google)

### Bugs / fixes
- Barre du bas incohérente ("Général") lors du drag and drop d'activités
- Depuis le pool, sélection d'une activité sous le calendrier : position mal reconnue à l'affichage
- Avis Google en anglais → traduire en français + "voir plus"

### Qualité / process
- Améliorer le .ico (manifest + png)
- Tests e2e avec Claude (skills, agents, bonnes pratiques)
- Secret de déploiement pour la release
- Menu : mode sombre / clair / système
