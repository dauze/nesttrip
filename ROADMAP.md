# NestTrip — Roadmap

Ce document sert de référence pour le projet ce qu'il reste à faire. Les items clos sont déplacés vers `ROADMAP_already done.md` (voir ce fichier pour l'historique détaillé) — ne pas les redupliquer ici.

### Plan d'exécution en cours (2026-08-11)
- Génération de voyage assistée par IA : Lots 1 à 3 faits, voir `ROADMAP_already done.md`. **Lot 4 (régénération ciblée d'un seul jour) — pas commencé, décision actée avec l'utilisateur le 2026-08-11 : reporté.** La spec elle-même (`src/specs/process-creation-trip-ia.md` §7) le conditionne aux retours d'usage réel des Lots 2/3 — à reprendre après un usage réel, pas avant.

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
- Dialogue note : le repositionnement clavier (VisualViewportService) ne fonctionne pas sur cette popup mais sur tous les autres oui — lorsque le clavier s'ouvre, la popup ne se décale pas assez vers le haut, le pied de page (boutons OK/Annuler) passe sous la barre finale du clavier. **Tentative de correctif le 2026-08-13 (2e passe)** : capture d'écran fournie par l'utilisateur montrant le bug reproduit — hauteur du panneau correcte mais POSITION verticale en cause, hypothèse retenue : `VisualViewportService` ne suivait que `visualViewport.height`, jamais `visualViewport.offsetTop` (le viewport visuel peut paner vers le bas au focus, sans que `.cdk-overlay-container` — `position:fixed`, ancré au viewport de LAYOUT — ne bouge lui). Ajout de `--nt-visual-viewport-offset-top` (VisualViewportService) + `top` sur `.cdk-global-overlay-wrapper` (dialog.scss) pour compenser ce panning. **Toujours pas vérifié sur device réel** (pas de clavier virtuel simulable dans ce bac à sable) — à confirmer par l'utilisateur.
- **Clos le 2026-08-13 (3e passe) :** dans les settings du trip, "Destination principale" et "Destinations additionnelles" fusionnées en une seule ligne "Destinations" (déplacée en tête de la liste des réglages, retour utilisateur), ouvrant `MultiCityDialogComponent` avec la principale COURANTE en 1ère position de la liste éditée. Décision UX actée avec l'utilisateur (question posée explicitement) : la 1ère position reste pleinement éditable/retirable comme les autres, pas figée en lecture seule — `résultat[0]` au relâchement devient la nouvelle principale. Bouton "OK" grisé si la liste est vidée (`MultiCityDialogComponent.noDestinationLeft`, un trip a toujours besoin d'au moins une destination). Le changement de la destination PRINCIPALE + rafraîchissement de la photo (`TripSettingsSectionComponent.resolveNewDestination`, réutilise `GooglePlaceService.getPlacePhotos$`) existait déjà de fait (implémenté plus tôt dans la journée, avant que cette note ne soit mise à jour) : une ville "additionnelle" promue en 1ère position n'ayant jamais de `placeId` connu côté client (`MultiCityFieldComponent` ne conserve que des noms), sa promotion déclenche systématiquement une étape de confirmation via recherche Google (jamais de résolution silencieuse par nom, risque d'homonymie) — annuler cette étape abandonne tout le geste (ni la ville ni les additionnelles ne changent).
- sur le déplacement de la camera sur la carte dans résumé, la faire moins varier en recul et accélérer un peu les transitions. Il faudrait également rajouter les titres des activités avec les photos. Je ne sais pas comment faire ça de manière compact et UI, propose moi un truc bien. (A affiner — demande explicite de proposition UX avant implémentation, décision actée le 2026-08-13 : laissé de côté cette session)

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
 

### Multipersonne (A affiner et surtout vérifier si c'est utile)
- Rajouter des attributions aux personnes associés sur tout pour pouvoir mettres des trajets, hotel et des transports + mettre une note "si le transport et partagé, mettre le prix unitaire" (non prioritaire)
  - Cela serait par defaut assigné à tous les voyageurs mais on pourrait en enlever
  - Dans le calcul du prix, compter que ceux ou le voyageur est sur les trajets et les activités
- Rajouter filtre mon planning et celui de tout le l'équipe (non prioritaire)


### Bugs / fixes
- Refaire une passe sur toutes les cinématiques de préremplissage des données pour les activités, les vols, les trains, les voitures et les hotels et autre pour être sur que tout fonctionne bien et que tous les champs sont saisi (Non prioritaire) 

### Qualité / process
- empacter le tout dans une application pour mobile ? Comment gérer la cohabitation ? décision d'architecture (Capacitor ? store ?) à prendre avec l'utilisateur avant de commencer  (non prioritaire)
- Profiter de angular 22 et éviter les async function : 15 fonctions identifiées (cinématiques guidées `NewTripComponent`/`LogisticDetailsComponent`/`MultiCityFieldComponent`/`TripSettingsSectionComponent`), l'adaptateur Observable→Promise dupliqué (`awaitOnce`) a été factorisé le 2026-08-17, mais la conversion des 15 fonctions elles-mêmes en chaînage RxJS (`concatMap`) est un chantier à part — c'est une réécriture de logique, pas une extraction pure, à faire dans une session dédiée avec vérification live (pas juste lint/tsc/tests).
- Définir des spec pour tout le code pour les parcours utilisateurs (et donc mettre des tests e2e qui couvrirait les différentes spec)
- 2 composants pour la liste sur mobile, un avec le check (`MenuComponent`) et un avec la ligne en surbrillance (`SelectComponent`) : confirmé par l'audit du 2026-08-17 (`day-distance-gap.component.ts`, sélecteur de mode de trajet, hack `icon: override === mode ? 'pi-check' : undefined` faute de notion de sélection native sur `MenuComponent`) — soit `AppMenuItem` gagne un `selected?: boolean` rendu nativement, soit tout picker à choix unique passe par `SelectComponent`.
- `app-menu`/`app-select` : ne pas fusionner (contrats différents, CVA vs commande) mais extraire la plomberie CDK overlay commune (~40 lignes dupliquées, position desktop/mobile/backdrop) dans un service partagé, probablement aussi consommé par `AutoCompleteComponent`.
- Préparer le modèle de données pour une intégration SQL à postériori : ajouter une colonne `position` explicite sur `DayActivityInstance` (au lieu de dépendre de l'ordre dans le tableau `activityIds`) et documenter le mapping "1 doc Firestore dénormalisé ↔ N tables SQL" quelque part (CLAUDE.md ou doc dédiée).
- DaypanelComponent : `day-panel.component.scss` a 66% de commentaires narratifs (historique de décisions produit) plutôt que des explications de données — à déplacer vers ROADMAP.md/CHANGELOG. **Évalué le 2026-08-18** : la plupart de ces commentaires expliquent en fait un POURQUOI technique non-obvious (interactions position:fixed/sticky, contreparties assumées, CSS mort déjà identifié) directement rattaché au code qu'ils documentent — les déplacer risquerait de couper ce contexte de sa source sans bénéfice clair ; laissé tel quel, pas un simple oubli. La simplification de la gestion de la carte (interpolation devenue inutile) n'a pas été auditée en détail.
- LogisticHeaderComponent : scss encore en dur (tailles d'icône `1.1rem`/`0.65rem`/`0.85rem` non alignées sur l'échelle `--nt-icon-size-*`) — pas traité : ces valeurs ont un historique de réglage fin documenté en commentaire (retours utilisateur, capture d'écran à l'appui), les aligner sur l'échelle changerait visuellement le rendu sans vérification live possible cette session (pas de compte `.env.e2e`).
- LinkActivityDialogComponent : espacements orphelins tokenisés le 2026-08-18 (`var(--nt-space-*)`, valeurs identiques, aucun changement visuel) — restent les 3 tailles de police (`1.1rem`/`0.8rem`/`0.875rem`) non alignées : pas d'échelle de taille de texte équivalente à `--nt-icon-size-*` dans `tokens.scss` aujourd'hui, à trancher dans une session dédiée (introduire une échelle ou juger que ce n'est pas nécessaire).
- `activity-type-rings.component.scss`/`expenses-table-dialog.component.scss` : référençaient un token `--nt-border-radius-sm` inexistant (jamais défini dans `tokens.scss`, retombait silencieusement sur son fallback) — corrigé le 2026-08-18 vers `--nt-radius-sm` (le vrai token) là où le fallback correspondait déjà exactement (aucun changement visuel), et en valeur en dur assumée là où il ne correspondait pas (`.rings-chart__bubble`, 0.375rem, aucun token existant à cette valeur).
- LogisticDetailsComponent (693 lignes) : les 5 méthodes `guidedXxx` (cinématiques guidées vol/logement/location/train/autre) ne sont volontairement pas extraites dans un service dédié — évalué le 2026-08-17, jugé trop couplé (viewChild des pickers, form, dialogs) pour une extraction sûre sans risque de régression comportementale ; à refaire en session dédiée avec vérification live, pas en lecture de code seule.
- `activity-type-rings.component.scss` (275 lignes) : pire ratio valeurs-en-dur/tokens du dossier `features/`, repéré par l'audit du 2026-08-17 mais pas encore examiné en détail (une partie du scss peut être structurellement nécessaire, géométrie SVG de cercles).
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
