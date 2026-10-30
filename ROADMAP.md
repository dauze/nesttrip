# NestTrip — Roadmap

Ce document sert de référence pour le projet ce qu'il reste à faire. Les items clos sont déplacés vers `ROADMAP_already done.md` (voir ce fichier pour l'historique détaillé) — ne pas les redupliquer ici.

### Plan d'exécution en cours (2026-10-30)
- **Accueil mobile — liste de voyages implémentée (2026-10-30), vérification visuelle sur l’app à confirmer.** Périmètre : accueil uniquement. Rangées conservées, vignettes élargies à 5.5rem et chip « En cours » posé sur la photo ; actions et navigation inchangées. Maquette validée. Lint, typecheck et tests unitaires passent ; confirmation sur l’app dans une session authentifiée dédiée (`.env.e2e` absent).
- **Gouttières des barres de navigation desktop/mobile — implémentées (2026-10-30).** Seuils inchangés ; barre mobile pleine largeur, onglets desktop bord-à-bord, jours toujours défilants. Maquette validée ; lint passé. Vérification visuelle sur l’app à confirmer dans une session authentifiée dédiée (`.env.e2e` absent).
- Génération de voyage assistée par IA : Lots 1 à 3 faits, voir `ROADMAP_already done.md`. **Lot 4 (régénération ciblée d'un seul jour) — pas commencé, décision actée avec l'utilisateur le 2026-08-11 : reporté.** La spec elle-même (`src/specs/process-creation-trip-ia.md` §7) le conditionne aux retours d'usage réel des Lots 2/3 — à reprendre après un usage réel, pas avant.
- **Parcours IA — sélection mobile implémentée (2026-10-30), vérification visuelle à confirmer.** Le sous-lot desktop est implémenté : liste avec retrait par croix, puis planification des activités gardées en `activities_day`/`full_plan`. Sur mobile, cartes à swiper à droite/gauche, validation toujours disponible, chargement de nouvelles propositions quand la pile est épuisée et liste complémentaire des activités gardées au-delà de 15 jours. Les vérifications automatisées passent ; il reste à confirmer le rendu dans une session authentifiée. Le Lot 4 (régénération ciblée d'un jour) reste reporté.

### Offline & données (non prioritaire)
- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible (A affiner)

### UI spécifique Desktop (A affiner)
- **Écran d'accueil "Mes voyages" en grille de cartes sur desktop — implémenté, vérification visuelle à confirmer (2026-10-30).** Le code respecte les décisions validées : liste mobile inchangée ; au-delà de 768px, grille de cartes-vignettes `auto-fill, minmax(17rem, 1fr)`, photo 16:10, chip "En cours" en overlay, tuile "Nouvelle aventure" et checkbox au survol/en mode sélection. Le rendu attend une confirmation dans une session authentifiée dédiée (`.env.e2e` absent).
- Vue calendrier (A affiner)
- **Déplacement interjours desktop — décision UX validée le 2026-10-30 : garder le calendrier mensuel défilant en bas pendant le drag.** L'overlay actuel regroupe les jours par mois et permet de défiler dans la grille ; il correspond au choix. Mobile inchangé. Confirmation visuelle à faire dans une session authentifiée dédiée (`.env.e2e` absent).
- **Onglet Général desktop, 3 problèmes de layout corrigés — 2026-09-30, EN COURS (à vérifier visuellement).** (1) Grand vide en haut : chaque sous-vue fill-width (trip-summary/trip-activities/logistics-list/notes) gardait son `padding-top: var(--chrome-top-offset)` (pensé pour le scrollport propre du swiper mobile) alors que le scrollport parent `.trip-general-desktop-root` le porte déjà une fois pour les 3 colonnes -> double réservation. Neutralisé par `padding-top: 0` dans chaque règle `:host(.app-*--fill-width)` (mobile inchangé). (2) Bug de largeur des cartes à la réduction : `grid-template-columns: 19rem 1fr 21rem` (latérales fixes non compressibles) -> passées en `minmax(14rem,19rem) minmax(0,1fr) minmax(15rem,21rem)`, même esprit que le `flex:0 1 32rem` compressible de day-panel. (3) Plancher barre de recherche activités abaissé 12rem -> 8rem (débordait la colonne centrale compressée). Reste ouvert : refonte visuelle plus large de la partie générale (hiérarchie, densité) si souhaité.
- **Refonte UX desktop (maquettes validées avec l'utilisateur le 2026-09-30, EN COURS).** Deux écrans maquettés en HTML/CSS (`.maquettes/desktop-general.html`, `.maquettes/desktop-jour.html`) puis validés. Consigne : interventions CSS MINIMALES (pas de refonte cosmétique des margins/paddings existants), disposition 3 colonnes Général et 2 colonnes Jour conservées, mobile strictement inchangé. Décisions actées :
  - **Onglet actif (barre des jours desktop + bouton Général) souligné en BAS** (border-bottom teal) au lieu du border-top actuel — cf. `trip-tabs-nav.component.scss` (`.app-tab` / `.app-tab.is-active`). Cohabiter avec le border-bottom hairline de `.app-tabs__list`.
  - **Vue Général desktop** : corriger UNIQUEMENT le scroll vertical (la page doit défiler jusqu'en bas) en gardant la barre des jours sticky en haut (ne défile pas). Donner un plancher réel à la colonne centrale (`minmax(0,1fr)` -> plancher ~26rem) pour qu'elle ne s'écrase plus. Ne pas retoucher le reste du CSS.
  - **Vue Jour desktop — carte escamotable (option B, décidée avec l'utilisateur)** : bouton chevron « replier le panneau » en HAUT de la colonne carte -> la colonne s'escamote vers la gauche, ne laissant qu'un onglet vertical fin pour la rouvrir. Remplace le mécanisme actuel cassé (poignée en bas, `.sticky-map` gardant une hauteur figée `calc(100dvh - …)` + fond blanc + ombre même repliée = bloc blanc résiduel, timeline poussée hors champ). NE PAS déplacer les overlays/contrôles SUR la carte en desktop (rendu de la carte inchangé). **Escamotage réservé au layout scindé** (`@media (orientation: landscape) and (min-width: 700px)` / `isSplitLayout`) — mobile garde sa poignée existante intacte.
  - **Vue Jour desktop — carte repliée = grille multi-colonnes** : quand la carte est escamotée, la colonne activités récupère toute la largeur et passe en grille `auto-fill` (~28rem min, donc 2-3 colonnes selon l'écran). La carte d'activité DÉPLIÉE (avec tous ses champs) occupe une colonne pleine largeur (span complet) ; les autres cartes se répartissent en grille.
- refondre toute la partie générale
- **Vue carte Jour — zoom global rapproché implémenté (décision UX du 2026-10-30), vérification visuelle à confirmer.** Le cadrage conserve tous les points avec un buffer réduit ; le zoom de la vue Général reste inchangé. Confirmation visuelle à faire dans une session authentifiée dédiée (`.env.e2e` absent).
- **Bouton + pour créer une activité dans le jour courant — décision validée le 2026-10-30, comportement déjà présent.** Le FAB global du jour appelle `DayActivityCreationService.startCreation()` ; confirmation visuelle à faire dans une session authentifiée dédiée (`.env.e2e` absent).
- **Vue Jour desktop — carte escamotable et commande sticky implémentées (2026-10-30), vérification visuelle à confirmer.** Le bouton « Réduire la carte » reste sticky sous le chrome ; sa hauteur est réservée dans le calcul de la carte pour qu'elle occupe le reste de la zone disponible. Le rail d'ouverture et la grille multi-colonnes carte repliée sont également présents. Confirmation visuelle à faire dans une session authentifiée dédiée (`.env.e2e` absent).

### UI 
- Quand on déplace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? (A affiner)


### Carte
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)
- **Carte du Résumé — bandeau de visite et caméra plus douce (UX validée le 2026-10-30, implémenté ; visuel à confirmer).** Pendant la promenade automatique, afficher en bas de carte un bandeau compact avec photo, titre, jour et progression ; le masquer dès une interaction manuelle. Rapprocher le zoom d’ensemble, limiter le recul des segments à 4 niveaux et accélérer les transitions.

### Activités
- Suggestions d'activités via la ville dans le pool (A affiner)

### Nouveau voyage / IA
- **Parcours de sélection des activités générées — desktop implémenté, sous-lot mobile EN COURS (2026-10-30).** Après la saisie du texte et la génération IA, choisir les activités avant la planification intelligente. Sur téléphone, cartes swipe à droite pour garder et à gauche pour passer, boutons explicites, validation fixe toujours accessible et demande d'un nouveau lot quand la pile est épuisée ; afficher la liste des activités gardées avec une croix au-delà de 15 jours. Sur ordinateur fixe et portable, conserver la liste avec croix. Les lots supplémentaires excluent les lieux déjà proposés et préservent les choix précédents.
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
- pour relier les points, tu pourrais faire un peux plus smooth, car des lignes droites ça fait trop carré
- sur la vue générale, il faudrait que tu agrandisse un peut la largeur de la colonne avec la carte, c'est un peu trop petit
- pour relier les points, tu pourrais faire un peux plus smooth, car des lignes droites ça fait trop carré
- sur la vue générale, il faudrait que tu agrandisse un peut la largeur de la colonne avec la carte, c'est un peu trop petit
 

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Non prioritaire)
- Diagnostiquer pourquoi le diagramme des dépenses ne s'affiche plus et rétablir son affichage.
- **Drag intra-jour — gaps de trajet masqués avec animation (2026-10-30), vérification visuelle à confirmer.** Les gaps se réduisent après le seuil de déplacement réel et réapparaissent au relâchement ; lint, typecheck et tests unitaires passent. La confirmation visuelle attend une session authentifiée dédiée (`.env.e2e` absent).
- Lorsque l'on arrive sur l'écran d'accueil aavec la liste des voyages, il faut que les photos soient en spinner avant de s'afficher le temps qu'elles se chargent
- mettre un padding sur la case à cocher et l'icone de drag de chaque ligne dans les listes de case à cocher
- la fleche pour aller à droite dans le calendrier à été remplacé par une croix à tord
- L'écran de voyage sur le bureau a des beug sur la liste des voyage, la timeline passe sous la carte à tord
- sur la vue ordinateur dans un jour, 2 problèmes : Le bouton réduire carte bouge un tout petit peut quand je scroll en bas, et la synchronisation entre la carte et les activitées via le scroll est cassé et plus aligné depuis que tu as rajouter la vue d'ensemble de la journée ou le bouton "réduire la carte"

### Qualité / process
- empacter le tout dans une application pour mobile ? Comment gérer la cohabitation ? décision d'architecture (Capacitor ? store ?) à prendre avec l'utilisateur avant de commencer  (non prioritaire)
- Profiter de angular 22 et éviter les async function : 15 fonctions identifiées (cinématiques guidées `NewTripComponent`/`LogisticDetailsComponent`/`MultiCityFieldComponent`/`TripSettingsSectionComponent`), l'adaptateur Observable→Promise dupliqué (`awaitOnce`) a été factorisé le 2026-08-17, mais la conversion des 15 fonctions elles-mêmes en chaînage RxJS (`concatMap`) est un chantier à part — c'est une réécriture de logique, pas une extraction pure, à faire dans une session dédiée avec vérification live (pas juste lint/tsc/tests).
- Définir des spec pour tout le code pour les parcours utilisateurs (et donc mettre des tests e2e qui couvrirait les différentes spec)
- 2 composants pour la liste sur mobile, un avec le check (`MenuComponent`) et un avec la ligne en surbrillance (`SelectComponent`) : confirmé par l'audit du 2026-08-17 (`day-distance-gap.component.ts`, sélecteur de mode de trajet, hack `icon: override === mode ? 'pi-check' : undefined` faute de notion de sélection native sur `MenuComponent`) — soit `AppMenuItem` gagne un `selected?: boolean` rendu nativement, soit tout picker à choix unique passe par `SelectComponent`.
- `app-menu`/`app-select` : ne pas fusionner (contrats différents, CVA vs commande) mais extraire la plomberie CDK overlay commune (~40 lignes dupliquées, position desktop/mobile/backdrop) dans un service partagé, probablement aussi consommé par `AutoCompleteComponent`.
- Préparer le modèle de données pour une intégration SQL à postériori : ajouter une colonne `position` explicite sur `DayActivityInstance` (au lieu de dépendre de l'ordre dans le tableau `activityIds`) et documenter le mapping "1 doc Firestore dénormalisé ↔ N tables SQL" quelque part (CLAUDE.md ou doc dédiée).
- TimelineComponent : `gap: 0.625rem` hors échelle, valeur unique non dupliquée ailleurs — laissé en dur (créer un token pour une valeur non répétée n'a pas le même ROI qu'une vraie déduplication ; l'aligner sur le plus proche token existant changerait le rendu, pas fait sans vérification visuelle — une session cloud parallèle avait tenté l'alignement sur `--nt-space-2`, revenu en arrière à la fusion du 2026-08-25 pour la même raison). Le badge icône 1.75rem, lui, a été tokenisé le 2026-08-17 (`--nt-icon-button-size`, dupliqué avec 3 autres fichiers).
- DaypanelComponent : `day-panel.component.scss` a 66% de commentaires narratifs (historique de décisions produit) plutôt que des explications de données — à déplacer vers ROADMAP.md/CHANGELOG. **Évalué le 2026-08-18** : la plupart de ces commentaires expliquent en fait un POURQUOI technique non-obvious (interactions position:fixed/sticky, contreparties assumées, CSS mort déjà identifié) directement rattaché au code qu'ils documentent — les déplacer risquerait de couper ce contexte de sa source sans bénéfice clair ; laissé tel quel, pas un simple oubli. La simplification de la gestion de la carte (interpolation devenue inutile) n'a pas été auditée en détail.
- LogisticHeaderComponent : tailles d'icône (`1.1rem`/`0.65rem`/`0.85rem`) non alignées sur l'échelle `--nt-icon-size-*`, chacune une valeur unique non dupliquée ailleurs — historique de réglage fin documenté en commentaire (retours utilisateur, capture d'écran à l'appui), pas touché sans vérification live (le pencil-button 1.75rem, lui, a été tokenisé).
- LinkActivityDialogComponent : espacements orphelins tokenisés le 2026-08-18 (`var(--nt-space-*)`, valeurs identiques, aucun changement visuel) — restent les 3 tailles de police (`1.1rem`/`0.8rem`/`0.875rem`) non alignées : pas d'échelle de taille de texte équivalente à `--nt-icon-size-*` dans `tokens.scss` aujourd'hui, à trancher dans une session dédiée (introduire une échelle ou juger que ce n'est pas nécessaire).
- `activity-type-rings.component.scss`/`expenses-table-dialog.component.scss` : référençaient un token `--nt-border-radius-sm` inexistant (jamais défini dans `tokens.scss`, retombait silencieusement sur son fallback) — corrigé le 2026-08-18 vers `--nt-radius-sm` (le vrai token) là où le fallback correspondait déjà exactement (aucun changement visuel), et en valeur en dur assumée là où il ne correspondait pas (`.rings-chart__bubble`, 0.375rem, aucun token existant à cette valeur).
- LogisticDetailsComponent (693 lignes) : les 5 méthodes `guidedXxx` (cinématiques guidées vol/logement/location/train/autre) ne sont volontairement pas extraites dans un service dédié — évalué le 2026-08-17, jugé trop couplé (viewChild des pickers, form, dialogs) pour une extraction sûre sans risque de régression comportementale ; à refaire en session dédiée avec vérification live, pas en lecture de code seule.
- CSP (Content-Security-Policy) complète pour le hosting : les headers de base (`X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`) sont en place depuis le 2026-08-17, mais pas de CSP — demande de lister tous les domaines autorisés (Maps, Fonts, Firebase, backend maison) et une vraie vérification live avant prod pour ne pas casser l'app.
- NotesComponent : le focus/curseur (`document.querySelector` impératif au clavier) n'a pas été extrait dans une directive dédiée — évalué le 2026-08-17, laissé tel quel (seules les fonctions pures de manipulation de tableau ont été extraites, voir `notes-points.util.ts`) : la partie DOM restante nécessiterait une vérification live du clavier/curseur pour être touchée sans risque.


### Industrialisation (non prioritaire)
- Faire une étude pour savoir les prochaines étapes pour potentiellement industrialiser l'application : 
  - Changement de la base vers une base postgres en conservant l'hydratation en temps réel
  - Réduire les cout en changeant de firebase à autre chose, à voir la renta
  - Gestion token multienv
  - Passage sur AppStore et Playstore ?
  - Gérer le cas de l'asi sans google ni les services google, quelles alternatives ?
  - faire sa banque de svg et se passer de prime-icons
