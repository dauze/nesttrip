# NestTrip — Roadmap

Ce document sert de référence pour le projet ce qu'il reste à faire. Les items clos sont déplacés vers `ROADMAP_already done.md` (voir ce fichier pour l'historique détaillé) — ne pas les redupliquer ici.

### Plan d'exécution en cours (2026-08-11)
- Génération de voyage assistée par IA : Lots 1 à 3 faits, voir `ROADMAP_already done.md`. **Lot 4 (régénération ciblée d'un seul jour) — pas commencé, décision actée avec l'utilisateur le 2026-08-11 : reporté.** La spec elle-même (`src/specs/process-creation-trip-ia.md` §7) le conditionne aux retours d'usage réel des Lots 2/3 — à reprendre après un usage réel, pas avant.

### Offline & données (non prioritaire)
- Mode hors ligne : quid des données Google (Maps/Places) en offline ?
- Stockage des fichiers en local si possible (A affiner)

### UI spécifique Desktop (A affiner)
- **Écran d'accueil "Mes voyages" en grille de cartes sur desktop — décidé avec l'utilisateur le 2026-09-30, EN COURS.** Sur mobile, liste de lignes inchangée. Au-delà de 768px : conteneur centré/borné + grille de cartes-vignettes (`auto-fill, minmax(17rem, 1fr)`), photo Google Places en visuel principal (16:10), chip "En cours" en overlay sur la photo, tuile "Nouvelle aventure" fantôme intégrée à la grille. Sélection/suppression : **option checkbox en overlay au survol de la carte, visible en permanence en mode sélection** (retour utilisateur : option 1 des 3 proposées). Ne toucher au mobile sous aucun prétexte (media query `min-width: 769px` uniquement).
- Vue calendrier (A affiner)
- Améliorer la vue jour, le résumé de la journé est trop étiré là
- Le scroll auto sur le premier element fait que l'on ne peut pas rester en haut en vu desktop cela déplace automatiquement 
- Le drag and drop lors du déplacement des activité d'un jour à l'autre, il faut le faire ailleur comme il n'y a pa la bar en ba de l'écran. Sur la bar en haut de l'écran directement ? Comment faire si beaucoup de jour ? Voir avec le skill UX
- **Onglet Général desktop, 3 problèmes de layout corrigés — 2026-09-30, EN COURS (à vérifier visuellement).** (1) Grand vide en haut : chaque sous-vue fill-width (trip-summary/trip-activities/logistics-list/notes) gardait son `padding-top: var(--chrome-top-offset)` (pensé pour le scrollport propre du swiper mobile) alors que le scrollport parent `.trip-general-desktop-root` le porte déjà une fois pour les 3 colonnes -> double réservation. Neutralisé par `padding-top: 0` dans chaque règle `:host(.app-*--fill-width)` (mobile inchangé). (2) Bug de largeur des cartes à la réduction : `grid-template-columns: 19rem 1fr 21rem` (latérales fixes non compressibles) -> passées en `minmax(14rem,19rem) minmax(0,1fr) minmax(15rem,21rem)`, même esprit que le `flex:0 1 32rem` compressible de day-panel. (3) Plancher barre de recherche activités abaissé 12rem -> 8rem (débordait la colonne centrale compressée). Reste ouvert : refonte visuelle plus large de la partie générale (hiérarchie, densité) si souhaité.
- **Refonte UX desktop (maquettes validées avec l'utilisateur le 2026-09-30, EN COURS).** Deux écrans maquettés en HTML/CSS (`.maquettes/desktop-general.html`, `.maquettes/desktop-jour.html`) puis validés. Consigne : interventions CSS MINIMALES (pas de refonte cosmétique des margins/paddings existants), disposition 3 colonnes Général et 2 colonnes Jour conservées, mobile strictement inchangé. Décisions actées :
  - **Onglet actif (barre des jours desktop + bouton Général) souligné en BAS** (border-bottom teal) au lieu du border-top actuel — cf. `trip-tabs-nav.component.scss` (`.app-tab` / `.app-tab.is-active`). Cohabiter avec le border-bottom hairline de `.app-tabs__list`.
  - **Vue Général desktop** : corriger UNIQUEMENT le scroll vertical (la page doit défiler jusqu'en bas) en gardant la barre des jours sticky en haut (ne défile pas). Donner un plancher réel à la colonne centrale (`minmax(0,1fr)` -> plancher ~26rem) pour qu'elle ne s'écrase plus. Ne pas retoucher le reste du CSS.
  - **Vue Jour desktop — carte escamotable (option B, décidée avec l'utilisateur)** : bouton chevron « replier le panneau » en HAUT de la colonne carte -> la colonne s'escamote vers la gauche, ne laissant qu'un onglet vertical fin pour la rouvrir. Remplace le mécanisme actuel cassé (poignée en bas, `.sticky-map` gardant une hauteur figée `calc(100dvh - …)` + fond blanc + ombre même repliée = bloc blanc résiduel, timeline poussée hors champ). NE PAS déplacer les overlays/contrôles SUR la carte en desktop (rendu de la carte inchangé). **Escamotage réservé au layout scindé** (`@media (orientation: landscape) and (min-width: 700px)` / `isSplitLayout`) — mobile garde sa poignée existante intacte.
  - **Vue Jour desktop — carte repliée = grille multi-colonnes** : quand la carte est escamotée, la colonne activités récupère toute la largeur et passe en grille `auto-fill` (~28rem min, donc 2-3 colonnes selon l'écran). La carte d'activité DÉPLIÉE (avec tous ses champs) occupe une colonne pleine largeur (span complet) ; les autres cartes se répartissent en grille.
- refondre toute la partie générale
- La vuue carte des jours est beaucoup trp dézoomé ! 
- voir avec le skill UX ou mettre le bouton + ? 
- il y a un moment ou l'affichage n'est pass bien entre la transition du mobile vers le desktop, quand on arrive après la largeur max de la bottom bar et de la liste de scool, des barres noire aapparaisent sur les coté, il faut trouver un moyen de soit faire la transition plus tôt vers le mode ordi, soit rajouter un mode, à trancher avec le skill ux
- gérer proprement tous es patting et faire en sorte que la age ne soit pa visible au niveau des écats autour de la bar des jours 

### UI 
- Quand on déplace les activités selon les jours, il faudrait pouvoir saisir les données de chaque carte via la cinématique puis revenir à l'onglet du pool ? (A affiner)
- sur la dialogue de note, mettre le focuse sur les note quand elle s'ouvre
- mettre les chevrons vers le bas sur le chip des trajet plutot que mettre un minus (celui entre les carte des activités de la vue day). Idement pour la liste déroulante de la devise dans le menum paramètres


### Carte
- Rajouter la Position actuelle de l'utilisateur sur la carte (non prioritaire)
- sur le déplacement de la camera sur la carte dans résumé, la faire moins varier en recul et accélérer un peu les transitions. Il faudrait également rajouter les titres des activités avec les photos. Je ne sais pas comment faire ça de manière compact et UI, propose moi un truc bien.
- il faut que l'icone ne soit plus collorié de la couleur primary mais putot par rapport au type ue c'est, couleur activité, repas, etc

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
 

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Non prioritaire)
- lors du drag and drop des activité sur un day, comme il y a les modes de transport ça fait un d'emplacement vide et on dirait qu'il y a un beug, on peut pas les masquer au drag et faire une annimation ou il se fond et disparaissent donc le carte se rapprochent en même temps que de se fermer ? 
- Lorsque l'on arrive sur l'écran d'accuei aavec la liste des voyaes, il faut que les photos soient en spinner avant de s'afficher le temps qu'elles se chargent
- mettre un padding sur la case à cocher et l'icone de drag de chaque ligne dans les listes de case à cocher

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
