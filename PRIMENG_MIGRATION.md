# Sortie de PrimeNG — plan de migration

PrimeNG devient payant à partir de la v22. Objectif : rendre l'appli 100% standalone
côté UI, en remplaçant PrimeNG (puis PrimeIcons et PrimeFlex) par des composants et
utilitaires maison, sans rien casser au passage.

Migration incrémentale (PrimeNG et le code maison coexistent pendant la migration),
composant par composant, sur une branche dédiée. `ng lint` + vérif visuelle manuelle
après chaque phase avant de passer à la suivante.

## Décisions retenues

- **PrimeFlex → utilitaires CSS maison** (pas Tailwind) : un seul fichier CSS couvrant
  le sous-ensemble réellement utilisé aujourd'hui (`flex`, `gap-*`, `col-*`,
  `justify-content-*`, `p-*`/`m-*`, `w-full`, `text-center`...), noms de classes
  identiques pour un portage quasi 1:1. Zéro nouvelle dépendance.
- **DatePicker → lib headless de calcul de dates + UI 100% maison.** Aucune lib de
  calendrier stylée : juste une lib qui calcule des dates/semaines/plages, tout le
  rendu et l'interaction restent maison.
- **PrimeIcons → `lucide-angular`.** Composants Angular individuels, tree-shakable,
  MIT. Une vingtaine d'icônes seulement à porter (`pi-trash`, `pi-plus`,
  `pi-calendar`, `pi-clock`, `pi-euro`, etc.).

## Dark mode — point important

PrimeNG **gère déjà le dark mode automatiquement aujourd'hui**, même si rien n'est
configuré explicitement dans `app.config.ts` : `providePrimeNG` n'y définit pas
`darkModeSelector`, et sa valeur par défaut est `"system"`, qui résout vers
`@media (prefers-color-scheme: dark)`. Autrement dit, l'appli suit déjà la préférence
OS de l'utilisateur de façon automatique, sans toggle manuel dans l'UI.

**Cette migration doit reproduire ce comportement à l'identique** : le thème maison
(Phase 0/1) doit lui aussi appliquer un jeu de tokens sombres automatiquement via
`@media (prefers-color-scheme: dark)`, sans qu'aucun toggle manuel n'existe (il n'y
en a pas aujourd'hui — na pas en inventer un qui n'a pas été demandé). Architecturer
le `ThemeService` de façon à ce qu'un toggle manuel puisse être ajouté plus tard sans
tout refondre, mais ne pas l'implémenter dans le cadre de cette migration.

## Levier disponible

`@angular/cdk` (v21) est déjà une **dépendance directe** du projet (pas juste
transitive via PrimeNG). Le sous-package `dialog` (`@angular/cdk/dialog`) est
disponible bien qu'aucun composant du projet ne l'importe encore aujourd'hui — il
n'apparaît pas comme dossier physique dans `node_modules/@angular/cdk/`, mais il est
bien exposé dans les `exports` du `package.json` du paquet (résolu vers
`fesm2022/dialog.mjs`), comme `overlay`, `a11y`, `portal`, `drag-drop`, mais aussi
`menu` et `listbox` — utiles pour la Phase 7 (Menu, Select, AutoComplete) le moment
venu. Ça couvre exactement ce qui est difficile à refaire soi-même (positionnement
d'overlay, focus-trap, ARIA, fermeture Echap/clic extérieur, restauration du focus) :
gros gain de risque pour Dialog / Select / AutoComplete / Menu / DatePicker.

## Piège identifié à ne pas rater

`ActivityDayDispatchOverlayComponent.cloneNavBarInto` **clone le DOM réel** du
`p-tabs`/`p-tab` (voir commentaires dans `src/styles.scss` autour de
`.dispatch-overlay__replica-tab--*`). Remplacer `Tabs` implique de mettre à jour
cette logique de clonage **dans la même phase**, pas après coup.

## Audit — état actuel

- **PrimeNG** : 24 familles de composants utilisées dans ~30 fichiers (liste
  détaillée dans le tableau plus bas).
- **PrimeIcons** : ~25 icônes distinctes utilisées.
- **PrimeFlex** : 180 occurrences de classes utilitaires dans 23 fichiers.
- **Thème** : un seul preset `Aura` custom (juste la couleur `primary` redéfinie dans
  `app.config.ts`), dark mode automatique via `system` (voir ci-dessus).
- **`ConfirmationService`** : utilisé dans 4 fichiers (`activity-card`,
  `accueil-trip`, `trip-detail`, `notes`).
- **Import mort** : `PrimeTemplate` (API dépréciée) importé dans
  `activity-google-info.component.ts` — à vérifier/nettoyer indépendamment de la
  migration.

## Phases

| Phase | Contenu | Risque | Statut |
|---|---|---|---|
| 0 | Tokens CSS maison (`--nt-*`) remplaçant les `--p-*` | Faible | ✅ Fait |
| 1 | Dark mode clair/sombre | Faible | ✅ Couvert par la Phase 0 (voir note) |
| 2 | Primitive `Dialog` maison sur `@angular/cdk/dialog`, réutilisée par toutes les phases suivantes qui ouvrent un panneau modal | Moyen | ✅ Fait (non consommée avant la Phase 7) |
| 3 | Composants visuels simples : Button, Tag, Chip, Divider, Fieldset, Avatar/AvatarGroup, ProgressSpinner, Skeleton, Message, Card, Toolbar | Faible | ✅ Fait |
| 4 | Champs simples : InputText, Password, Textarea, InputNumber, Checkbox, SelectButton | Faible | ✅ Fait (suppression de `Fluid` reportée à la Phase 7, voir note) |
| 5 | `Panel` maison (collapsible très réutilisé : activity-card, notes, activity-google-info, activity-gallery, trip-day-map) | Moyen | ✅ Fait |
| 6 | `Tabs` maison + mise à jour de `cloneNavBarInto` dans `ActivityDayDispatchOverlayComponent` (voir piège ci-dessus) | Moyen | ✅ Fait |
| 7 | Overlays complexes sur la primitive `Dialog` de la Phase 2 (+ `@angular/cdk/menu`/`listbox` pour Select/Menu) : Menu, Tooltip, `ConfirmDialog` + `ConfirmationService` maison, Select, AutoComplete (recherche Google Places), DatePicker (lib headless + UI maison). Risque élevé vu le nombre de familles bundlées : découpée en sous-phases testées indépendamment (7a Tooltip, 7b Menu, 7c ConfirmDialog+Dialog, 7d Select, 7e AutoComplete, 7f DatePicker), même workflow build/lint/test visuel qu'une phase à part entière | Élevé | ✅ Fait (7a-7f) |
| 8 | `FileUpload` → bouton + `<input type="file" multiple>` natif (mode `basic` actuel, pas de zone de drop à gérer) | Faible | À faire |
| 9 | Suppression `primeng`, `@primeuix/themes`, `primelocale` (les ~10 clés de traduction FR portées en dur) | — | À faire |
| 10 | PrimeIcons → `lucide-angular` | Faible | À faire |
| 11 | PrimeFlex → fichier CSS utilitaire maison | Faible | À faire |
| 12 | Régression manuelle complète (desktop/mobile, dialogs, drag-and-drop inter-jours) + `ng lint`/`ng test` | — | À faire |

## Détail des composants PrimeNG à remplacer

| Composant PrimeNG | Fichiers principaux | Phase |
|---|---|---|
| Button | ~10 fichiers (activity-card, notes, trips, login...) | 3 |
| Card | login, accueil-trip, new-trip, notes, trip-activities, trip-header | 3 |
| Skeleton | accueil-trip, trip-detail(-skeleton), day-panel | 3 |
| Message | login, accueil-trip, collaborators-dialog, notes, trip-activities, day-panel | 3 |
| Tag | activity-header, activity-google-info | 3 |
| Divider | login, activity-card, activity-form, activity-google-info, activity-gallery, timeline | 3 |
| Avatar / AvatarGroup | collaborators-dialog, trip-collaborators | 3 |
| ProgressSpinner | activity-card, activity-files, activity-gallery | 3 |
| Toolbar | trips | 3 |
| Chip | activity-files | 3 |
| Fieldset | notes | 3 |
| InputText | login, new-trip, collaborators-dialog | 4 |
| Password | login | 4 |
| Textarea | trip-header, notes, activity-form | 4 |
| InputNumber | activity-form | 4 |
| Checkbox | accueil-trip, notes | 4 |
| SelectButton | general-panel | 4 |
| Fluid | new-trip | 4 (suppression reportée) → 7f ✅ |
| Panel | activity-card, activity-google-info, activity-gallery, trip-activities, notes, timeline, day-panel, trip-day-map | 5 |
| Tabs / Tab / TabList | trip-tabs-nav (+ clone dans activity-day-dispatch-overlay) | 6 |
| Menu / MenuItem | trips (roue crantée) | 7b ✅ |
| Tooltip | accueil-trip, collaborators-dialog, trip-collaborators | 7a ✅ |
| Dialog / ConfirmDialog / ConfirmationService | time-picker-dialog, collaborators-dialog, accueil-trip, trip-detail, activity-card, notes | 7c ✅ |
| Select | activity-form, timeline | 7d ✅ |
| AutoComplete | new-trip, activity-header | 7e ✅ |
| DatePicker | new-trip, trip-header, activity-form | 7f ✅ |
| FileUpload | activity-files | 8 |

## Journal des phases faites

### Phase 0 — Tokens CSS maison

- `src/styles/tokens.scss` : variables `--nt-*` (primary, surface, texte, contenu,
  overlay, champs de formulaire, rayons, focus ring, couleurs de statut), avec
  variante sombre sous `@media (prefers-color-scheme: dark)`. Valeurs reprises du
  preset Aura par défaut (jamais redéfinies dans ce projet, à part `primary`) pour
  que le rendu ne bouge pas tant que les composants n'ont pas migré.
- Importé dans `src/styles.scss` via `@use`.

### Phase 1 — Dark mode

Pas de fichier dédié : le comportement (suivre `prefers-color-scheme` sans toggle
manuel) est déjà entièrement porté par le bloc `@media` de `tokens.scss`. Créer un
`ThemeService` qui n'aurait aucun état à gérer (pas de toggle) aurait été une
abstraction inutile — à ajouter seulement si un toggle manuel est demandé plus tard.

### Phase 2 — Primitive Dialog

- `src/app/shared/services/dialog.service.ts` : fine couche au-dessus de
  `Dialog`/`DialogRef` de `@angular/cdk/dialog` (`providedIn: 'root'`, aucun module à
  importer). Pose les classes par défaut `app-dialog-panel`/`app-dialog-backdrop` et
  quelques réglages par défaut (`autoFocus`, `restoreFocus`, `closeOnNavigation`),
  fusionnés avec la config fournie par l'appelant plutôt que de l'écraser.
- `src/app/shared/components/dialog-frame/` (`DialogFrameComponent`) : habillage
  visuel commun (header + titre + bouton fermer, zone de contenu scrollable, zone de
  footer projetée via `[dialogFooter]`) que les futurs composants de dialog (Phase 7 :
  ConfirmDialog, CollaboratorsDialog, TimePickerDialog) utiliseront dans leur propre
  template. Composant purement présentationnel, sans dépendance à `DialogRef`.
- `src/styles/dialog.scss` : classes globales `.app-dialog-backdrop`/`.app-dialog-panel`
  (fond flouté, rayon/ombre/couleurs sur les tokens `--nt-overlay-*`, transition
  d'entrée) — globales car les éléments CDK sont montés dans `.cdk-overlay-container`,
  en dehors de l'arbre du composant hôte.
- `node_modules/@angular/cdk/overlay-prebuilt.css` ajouté aux `styles` dans
  `angular.json` : CSS structurel requis par `cdk/overlay` (positionnement du
  conteneur/backdrop), que PrimeNG n'utilise pas en interne et qui n'était donc pas
  encore inclus.

**Non consommé pour l'instant** : aucun composant existant n'utilise encore
`DialogService`/`DialogFrameComponent` — ils ne seront branchés qu'à la Phase 7
(ConfirmDialog, CollaboratorsDialog, TimePickerDialog). Vérifié par `ng build`
(compilation + vérification de templates AOT) et `ng lint`, aucune régression. Pas de
test de rendu réel possible tant qu'aucun consommateur n'existe — à valider
visuellement dès le premier dialog migré en Phase 7.

### Phase 3 — Composants visuels simples

Onze composants maison créés sous `src/app/shared/components/` (`button`,
`tag`, `chip`, `divider`, `fieldset`, `avatar`, `avatar-group`,
`progress-spinner`, `skeleton`, `message`, `card`, `toolbar`), tous stylés sur
les tokens `--nt-*` de la Phase 0. Tous les usages existants (~25 fichiers)
ont été migrés — plus aucun import `primeng/{button,card,skeleton,message,
divider,tag,avatar,avatargroup,progressspinner,toolbar,chip,fieldset}` dans
le projet.

Choix notables :
- **Button** : pas d'output `click` dédié — un clic sur le `<button>` interne
  remonte par bubbling DOM natif jusqu'au tag hôte, donc `(click)="..."`
  fonctionne directement sur `<app-button>`. Tous les `(onClick)="..."`
  PrimeNG ont été normalisés en `(click)="..."` au passage. Supporte la
  projection de contenu (`<ng-content>`) pour le cas particulier des
  boutons-jours de `ActivityDayDispatchOverlayComponent`.
- **Tag / Message / Avatar** : le `:host` EST la boîte visuelle (pas
  d'élément interne séparé), pour qu'une classe utilitaire posée par le
  consommateur (`class="w-full ..."`) s'applique directement, sans wrapper
  qui l'empêcherait de porter. Leurs variantes de sévérité utilisent
  `:host(.ma-classe)` (pas `.ma-classe` seul) — piège identifié en cours de
  route : un sélecteur nu ne peut pas matcher le host sous l'encapsulation
  Angular émulée (`_nghost-*` vs `_ngcontent-*`).
- **Card / Fieldset / Toolbar** : les `<ng-template pTemplate="title">`/
  `#header`/`#footer`/`#start`/`#center`/`#end` de PrimeNG sont remplacés par
  des slots de projection nommés via attribut (`[cardTitle]`, `[cardHeader]`,
  `[cardFooter]`, `[toolbarStart]`...), plus simples qu'un
  `@ContentChild(TemplateRef)` vu qu'il n'y avait qu'un seul (ou zéro)
  appelant à adapter par template. Les slots vides ne génèrent aucune boîte
  visible (`:empty` en CSS).
- **AvatarGroup** : le chevauchement des avatars est posé côté
  `AvatarComponent` via `:host-context(app-avatar-group)`, pas via
  `::ng-deep` sur le groupe (qui n'aurait pas pu cibler le contenu projeté
  correctement sous l'encapsulation de vue).
- Nettoyage connexe : quelques imports PrimeNG déjà morts avant cette phase
  ont été retirés en route (`SkeletonModule` dans `trip-detail.component.ts`,
  `DividerModule` dans `activity-gallery.component.ts`,
  `ProgressSpinnerModule` dans `activity-card.component.ts`), ainsi qu'une
  vérification `.p-chip-remove-icon` devenue obsolète dans
  `activity-files.component.ts` (le nouveau `ChipComponent` fait déjà
  `stopPropagation()` sur le bouton de suppression).

Vérifié par `ng build` après chaque composant et `ng lint` final (aucune
nouvelle erreur — un seul écart corrigé en route : le header repliable de
`FieldsetComponent` avait besoin de `role="button"`/`tabindex`/
`(keydown.enter)` pour l'accessibilité clavier). **Pas de test de rendu réel
dans un navigateur** — à valider visuellement à l'occasion.

### Phase 4 — Champs de formulaire simples

Découverte utile en démarrant cette phase : `pInputText`/`pTextarea` sont chez
PrimeNG de simples **directives** de style posées sur un `<input>`/
`<textarea>` natif (pas des composants) — `formControlName`/`ngModel`
fonctionnent donc déjà nativement dessus, sans ControlValueAccessor à écrire.
D'où deux stratégies différentes selon le composant :

- **InputText → `InputTextDirective`** (`src/app/shared/directives/`) et
  **Textarea → `TextareaDirective`** : de simples directives qui posent une
  classe CSS (`app-input-text`/`app-textarea`, stylées globalement dans
  `src/styles/form-fields.scss`, nouveau). `TextareaDirective` gère aussi
  l'auto-grandissement en hauteur (toujours actif — les 3 usages du projet le
  demandaient déjà systématiquement, pas besoin d'un input pour le
  désactiver). Les `[invalid]="form.controls.x.touched && ...invalid"`
  PrimeNG ont été supprimés : Angular pose déjà `.ng-invalid`/`.ng-touched`
  automatiquement sur les champs liés à un formulaire réactif, `form-fields.scss`
  cible directement ces classes natives.
- **InputNumber → `InputNumberComponent`** et **Password →
  `PasswordComponent`** (`src/app/shared/components/`) : ces deux-là ont une
  vraie logique propre côté PrimeNG (formatage numérique, bascule
  afficher/masquer), donc de vrais composants avec `ControlValueAccessor`
  (`NG_VALUE_ACCESSOR`), pour rester compatibles `formControlName` (seul
  usage réel : le prix d'une activité, le mot de passe du login).
- **Checkbox → `CheckboxComponent`** et **SelectButton →
  `SelectButtonComponent`** : aucun des usages existants ne passe par
  `formControlName` (seulement `[ngModel]`/`[(ngModel)]`), un simple
  `model()` signal suffit donc — pas de CVA nécessaire.
- **`.transparent-inputtext`/`.transparent-textarea`** (styles.scss) : ces
  classes ne ciblaient que les variables internes PrimeNG (`--p-inputtext-*`,
  `--p-textarea-*`). Elles ciblent maintenant *aussi* les nouvelles
  `--nt-form-field-*`, en plus des anciennes — nécessaire tant que
  `.transparent-inputtext` reste partagée avec `p-datepicker` (pas encore
  migré, Phase 7), donc les deux jeux de variables doivent coexister.
- **`Fluid` non supprimé** : `<p-fluid>` n'est pas qu'un wrapper inerte, il
  élargit automatiquement en CSS ses descendants PrimeNG (`p-autoComplete`,
  `p-datepicker`) à 100% — supprimer le wrapper maintenant aurait rétréci ces
  deux composants pas encore migrés (new-trip.component). Reporté à la
  Phase 7, quand `AutoComplete`/`DatePicker` seront remplacés (mes propres
  champs sont déjà `width: 100%` par défaut, donc `Fluid` deviendra alors
  sans objet).

Vérifié par `ng build` et `ng lint` (deux erreurs `no-empty-function`
introduites par les callbacks `onChange`/`onTouched` par défaut des CVA,
corrigées en rendant ces champs optionnels — `this.onChange?.(...)` plutôt
qu'une fonction vide assignée par défaut). **Pas de test de rendu réel dans
un navigateur.**

### Phase 5 — Panel

Le composant le plus réutilisé du projet (9 fichiers, 11 usages). Conçu avec
un bouton de bascule toujours ajouté **après** le contenu du header projeté
(`[panelHeader]`), exactement comme PrimeNG l'ajoutait dans sa propre
`.p-panel-header-actions` — important pour les headers custom avec leurs
propres boutons (notes.component : poignée de drag + 2 boutons), qui ne
doivent pas devenir cliquables pour le toggle.

Points techniques :
- **`beforeToggle`/`afterToggle`** émettent l'état **cible** (celui vers
  lequel le panel bascule), pas l'état courant — c'est ce que lisent
  `activity-google-info`/`activity-gallery` pour lazy-charger leur contenu à
  la première expansion (`if (!event.collapsed) { ... }`). `afterToggle` est
  émis immédiatement après le changement d'état, pas après la fin de
  l'animation CSS — vérifié que le seul consommateur (`day-panel`,
  `onActivitiesPanelToggled`) ne comptait déjà pas sur ce timing (il gère son
  propre délai via `setTimeout(300)` en commentaire explicite).
- **`instant`** (repli sans animation) remplace le mécanisme PrimeNG
  `[motionOptions]="{ duration: 0 }"` de `ActivityCardComponent` (utilisé
  pendant un drag, pour qu'un repli forcé ne soit jamais capturé à
  mi-animation) — même bascule signal `true` → `requestAnimationFrame` →
  `false`, juste un booléen au lieu d'un objet `{ duration }`.
- **Animation d'ouverture/fermeture** : `grid-template-rows: 1fr` ↔ `0fr`
  (technique CSS moderne), pas de mesure JS de hauteur.
- Le contenu du `<ng-template pTemplate="content">` d'`activity-google-info`
  (qui retardait l'instanciation DOM chez PrimeNG) est maintenant du contenu
  projeté normal, toujours présent dans le DOM mais visuellement replié — le
  chargement des données Google reste bien lazy (piloté par `beforeToggle`,
  pas par l'instanciation DOM), seule différence : quelques nœuds DOM
  inactifs existent avant la première expansion. Négligeable vu le volume de
  contenu concerné.
- **`.not-dispatched ::ng-deep > .p-panel`** (activity-card.component.scss)
  simplifié en `.not-dispatched > app-panel` (plus besoin de `::ng-deep`) :
  `.p-panel` était une classe posée par PrimeNG sur un élément interne à SA
  PROPRE vue (d'où `::ng-deep` pour la percer), alors qu'`app-panel` est
  écrit directement dans le template d'`ActivityCardComponent` et porte donc
  déjà son attribut de scope.
- CSS global mort supprimé de `styles.scss` : `.p-panel-content(-container)`,
  `.p-panel-toggle-button`, `.p-panel-header-actions` (chevron désormais dans
  `panel.component.scss`).

Vérifié par `ng build`/`ng lint`. **Pas de test de rendu réel dans un
navigateur** — vu la complexité des interactions (drag-and-drop de notes,
repli forcé pendant le drag d'activité, lazy-loading Google), ce composant
mériterait particulièrement un test visuel avant de continuer.

#### Correctifs post-Phase 5 (trouvés en testant dans le navigateur)

Le test visuel a bien révélé des bugs que la compilation ne pouvait pas
attraper — trois corrections après coup :

- **Hauteur de repli/dépli fausse + lazy-load figé à l'ancienne hauteur** :
  le hack CSS `grid-template-rows: 1fr/0fr` abandonné au profit d'une mesure
  JS réelle (`scrollHeight`) → `max-height` animé, avec le padding déplacé
  sur un enfant interne (jamais sur l'élément dont la hauteur est animée,
  sinon il reste visible même à `max-height: 0`).
- **Lazy-load qui se déclenchait à la fermeture au lieu de l'ouverture** :
  `beforeToggle` émettait l'état CIBLE : corrigé pour émettre l'état COURANT
  (celui d'avant bascule) — contre-intuitif vu le nom, mais c'est ce
  qu'attend `if (!event.collapsed) return` côté
  `activity-google-info`/`activity-gallery`.
- **Spinner de chargement invisible au premier dépli** : la mesure de
  hauteur s'exécutait avant que l'effet asynchrone déclenché par
  `beforeToggle` (`toObservable`/`effect`, jamais synchrone avec un
  `.set()`) ait eu le temps de peindre le spinner — elle attend maintenant
  une frame (`requestAnimationFrame`) après `beforeToggle`.
- **Bouton entouré d'un cercle visible** (notes.component) : certains
  appelants posent `[text]="true"` ET `[outlined]="true"` en même temps
  (repris tel quel de l'ancien markup) ; les deux classes avaient la même
  spécificité CSS et `outlined` l'emportait. Ajout d'une règle combinée
  `.app-button--text.app-button--outlined` pour que `text` gagne.
- **Poignée de resize native réapparue sur les textarea** : `resize:
  vertical` au lieu de `resize: none` dans `form-fields.scss` — corrigé (le
  redimensionnement reste piloté par `TextareaDirective`, pas la poignée
  native).
- **Texte des textarea barrés illisible/hauteur à 0** : deux tentatives
  avant la bonne. D'abord un `effect()` sur un `value` input dédié
  (intercepter `[value]="..."` pour réagir aussi aux changements
  PROGRAMMATIQUES, pas seulement `(input)`) — mais l'effet pouvait
  s'exécuter avant la passe de layout du navigateur, mesurait un
  `scrollHeight` de 0 et le figeait en dur. Solution finale, plus simple et
  plus robuste : `afterEveryRender()` (pas `afterNextRender`, qui ne tourne
  qu'une fois) — recalcule après CHAQUE rendu de l'app, sans essayer de
  deviner quel événement a changé la valeur affichée.

### Phase 6 — Tabs

Un seul consommateur (`trip-tabs-nav`), contenu de chaque onglet entièrement
custom (pile jour/libellé "Général"), construit directement dans SON PROPRE
template — pas de composant `Tabs`/`Tab` générique à part créé sous
`shared/components/` (aurait été une abstraction sans second appelant) :
juste `<p-tabs>`/`<p-tablist>`/`<p-tab>` remplacés par du HTML/CSS natif
(`.app-tabs` / `.app-tabs__list` / `.app-tab`) directement dans
`trip-tabs-nav.component.html/scss`.

Piège anticipé en Phase 0 (voir plus haut) traité en même temps, comme
prévu : `ActivityDayDispatchOverlayComponent.cloneNavBarInto` clone
`.app-tabs` (avant `<p-tabs>`) et cherche `.app-tabs__list` (avant
`.p-tablist-content`) pour synchroniser le scroll horizontal de la réplique.
`data-tab-id`/`role="tab"` conservés à l'identique (déjà posés sur les
éléments d'origine, donc déjà présents sur le clone) : aucune autre logique
de l'overlay (FLIP, matching par id) n'a eu besoin de changer.

Le style actif/hover (indicateur du haut en `primary`, pas d'assombrissement
au survol) vivait éparpillé dans des surcharges de variables PrimeNG
globales (`--p-tabs-tab-border-width`, `--p-tabs-tab-hover-color`) dans
`styles.scss` — regroupé directement dans `trip-tabs-nav.component.scss`,
plus lisible et sans dépendre d'un composant externe. `.tabs-pop` (animation
de "pop" au changement d'onglet, styles.scss) mis à jour pour cibler
`.app-tab` au lieu du tag `p-tab`.

Nettoyage connexe : plusieurs autres surcharges PrimeNG déjà mortes
supprimées de `styles.scss` en même temps (`.p-tabpanels` — aucun
`<p-tabpanel>` dans le projet, la navigation entre jours passe par Swiper,
pas par le système de panels de PrimeNG ; `.p-card`, `.p-toolbar` — morts
depuis la Phase 3). Un vrai oubli corrigé au passage : `.compact-form`
(activity-form) ciblait encore `.p-inputtext` pour le padding compact du
champ prix, alors que ce champ est `app-input-number`/`.app-input-text`
depuis la Phase 4 — la classe ne matchait plus rien, régression silencieuse
(padding non compact) jamais signalée.

Vérifié par `ng build`/`ng lint` — le chunk `trip-detail-component` a
nettement rétréci (1,01 Mo → 965 Ko), confirmant que `primeng/tabs` a bien
disparu du bundle. **Pas de test de rendu réel dans un navigateur.**

#### Correctifs post-Phase 6 (trouvés en testant dans le navigateur)

- **Réplique clonée désynchronisée du scroll horizontal réel** :
  `cloneNavBarInto` (`ActivityDayDispatchOverlayComponent`) copiait bien
  `scrollLeft` depuis la barre source vers le clone `.app-tabs__list`, mais
  juste après `appendChild` un nœud fraîchement inséré n'a pas encore de zone
  scrollable établie côté navigateur — l'écriture de `scrollLeft` était donc
  silencieusement clampée à 0. Corrigé en forçant une passe de layout
  synchrone (`void cloneScroller.offsetWidth;`) entre l'insertion et
  l'écriture de `scrollLeft`.
- **Carte de dépose mal dimensionnée, uniquement au tout premier drag de la
  session, avant tout survol de la barre** : `openSheet()` (le seul endroit
  qui clonait la barre et mesurait sa hauteur repliée) n'est appelé qu'à une
  vraie escalade (`phase === 'lifted'`). Mais l'aperçu "barre repliée"
  (`.dispatch-overlay--bar-visible`, piloté par
  `dispatchService.activeDayDrag() !== null`) s'affiche dès le tout premier
  `cdkDrag`, AVANT toute escalade réelle — sur une session fraîche, la
  réplique était donc vide et à la hauteur de secours CSS (56px, au lieu de
  la vraie hauteur ~77px), d'où le contenu tronqué. Logique de clonage +
  mesure extraite dans une méthode partagée `primeReplicaPreview()`, appelée
  par `openSheet()` à chaque décrochage réel (pour rester fidèle à un
  éventuel scroll entre-temps) ET une fois à l'amorçage — mais **pas** via un
  `afterNextRender` one-shot dans le constructeur de l'overlay, tentative
  initiale qui s'est révélée insuffisante : `TripTabsNavComponent` n'est monté
  qu'une fois le trip chargé (async, derrière un `@if`), donc potentiellement
  APRÈS le premier rendu de l'overlay — l'`afterNextRender` s'exécutait alors
  avant que la barre réelle ne se soit jamais enregistrée
  (`registerNavBarCloneSource`), et ne se redéclenchant jamais, l'amorçage
  restait cassé pour le reste de la session (confirmé par un `console.log`
  temporaire : `collapsedHeightSignal` bloqué à 56 alors que la vraie barre
  mesurait déjà 76.95px). Solution retenue : `navBarEl`/`navBarCloneSourceEl`
  dans `ActivityDispatchService` transformés en `signal` plutôt que de simples
  champs, et l'overlay amorce sa réplique via un `effect()` qui réagit au
  moment réel de l'enregistrement de la barre (une seule fois, via un flag
  local), quel que soit l'ordre de montage des deux composants.

### Phase 7a — Tooltip

Trois usages seulement (accueil-trip, trip-collaborators,
collaborators-dialog), tous de simples bulles de texte sans interaction —
contrairement au reste de la Phase 7 (Menu, Select, AutoComplete, DatePicker),
qui a besoin de vrai positionnement d'overlay/focus-trap/fermeture au clic
extérieur. `TooltipDirective` (`src/app/shared/directives/tooltip.directive.ts`)
n'utilise donc **pas** `@angular/cdk/overlay` : juste un `<div class="app-tooltip">`
créé à la volée et ajouté en enfant direct de `document.body`, positionné en
`position: fixed` à partir de `getBoundingClientRect()` de la cible, avec
repositionnement sur `scroll`/`resize` tant qu'elle est affichée. Style
(`src/styles/tooltip.scss`, global comme `dialog.scss` — même raison, DOM
ajouté hors de l'arbre de vue du composant hôte) repris du preset Aura :
fond `--nt-surface-700`/texte `--nt-surface-0` (bulle sombre dans les deux
modes, comme PrimeNG), `--nt-overlay-popover-shadow`/`-border-radius`
(déjà définis en Phase 0, réutilisés tels quels). `z-index: 1200` choisi
explicitement au-dessus de `.cdk-overlay-container` (1000) et du `zIndex.tooltip`
par défaut de PrimeNG (~1100) : un tooltip doit rester visible même déclenché
depuis l'intérieur d'un dialog encore ouvert (`p-dialog` dans
collaborators-dialog, pas encore migré — voir Phase 7c).

API calquée sur `pTooltip` pour un portage quasi 1:1 des templates
(`pTooltip="..."` → `appTooltip="..."`, `tooltipPosition`/`tooltipDisabled`/
`tooltipEvent` identiques) : seul le nom de l'attribut principal change.
Écoute `focusin`/`focusout` plutôt que `focus`/`blur` (qui ne bubblent pas) :
la directive est parfois posée sur un composant dont le host n'est pas
lui-même l'élément focusable (`<app-button appTooltip>`, dont le `<button>`
réel est interne) — seuls les événements qui remontent permettent au
listener posé sur le host de les capter.

Vérifié par `ng build`/`ng lint`, plus aucun import `primeng/tooltip` dans le
projet. **Pas de test de rendu réel dans un navigateur.**

### Phase 7b — Menu

Un seul consommateur (`TripsComponent`, roue crantée), toujours en mode
`[popup]="true"` (aucun mode inline à porter). Contrairement au Tooltip
(7a), un vrai popup ancré a besoin de fermeture au clic extérieur/Échap et
de repositionnement anti-débordement d'écran — cette fois construit sur
`@angular/cdk/overlay` directement (pas `cdk/dialog`, dont la sémantique
modale/focus-trap ne convient pas à un simple menu ancré à un bouton) :
premier consommateur de `cdk/overlay` du projet, dont
`overlay-prebuilt.css` est déjà chargé depuis la Phase 2 (`Dialog`).

- `MenuComponent` (`src/app/shared/components/menu/`) expose `toggle(event)`
  (identique à l'ancien `menu.toggle($event)` du template), et une
  `<ng-template #panel>` attachée à l'overlay via `TemplatePortal` au moment
  de l'ouverture — le contenu (labels/icônes) reste donc du vrai template
  Angular avec CD normale, pas du DOM construit à la main.
- `AppMenuItem` (type local, remplace `MenuItem` de `primeng/api`) reprend le
  même modèle que PrimeNG : une entrée top-level avec `items` est un groupe
  (affiche son `label` en en-tête, ses `items` en dessous) ; sans `items`,
  l'entrée elle-même est un item cliquable à plat — les deux formes
  cohabitent dans le même tableau, gérées par un simple `@if (group.items)`
  dans le template.
- Positionnement `flexibleConnectedTo(trigger)` ancré sous le bord droit du
  bouton déclencheur (`event.currentTarget`), bascule au-dessus si la place
  manque en bas (`withPush(true)` + deux `ConnectedPosition` haut/bas) —
  équivalent du positionnement automatique de PrimeNG.
- Style (`menu.component.scss`) repris du preset Aura navigation/menu :
  fond/bordure/rayon `--nt-content-*`, ombre `--nt-overlay-popover-shadow`,
  hover d'item en `--nt-surface-100`, en-tête de groupe en
  `--nt-text-muted-color` — tous des tokens déjà existants depuis la Phase 0,
  aucun nouveau token nécessaire.
- **z-index simplifié** : `.cdk-overlay-container` a un z-index par défaut
  de 1000, largement au-dessus de l'échelle `--z-*` de l'appli (max 100) —
  contrairement à PrimeNG dont le zIndex dynamique pouvait tomber sous le
  chrome fixe (`.app-toolbar`/`.app-trip-header-fixed`), d'où le
  `!important` sur `.p-menu-overlay` supprimé de `styles.scss` (l'override
  équivalent reste nécessaire pour `.p-datepicker-panel`/`.p-select-overlay`,
  pas encore migrés — Phases 7d/7f).

Vérifié par `ng build`/`ng lint`, plus aucun import `primeng/menu` dans le
projet. **Pas de test de rendu réel dans un navigateur.**

#### Correctif post-Phase 7b (trouvé en testant dans le navigateur)

- **États hover/icône illisibles en dark mode** : `menu.component.scss`
  utilisait des primitives brutes (`--nt-surface-100`/`400`/`500`) pour le
  fond au survol et la couleur des icônes — même piège qu'en Phase 3
  (Button/Tag/Avatar/Skeleton/Message) : ces jetons gardent la même
  tonalité (claire) dans les DEUX modes, "100" désignant une position sur
  l'échelle, pas "clair en light". En dark mode ça donnait un flash de fond
  quasi blanc au survol sur un panneau sombre. Corrigé en passant aux jetons
  sémantiques déjà éprouvés ailleurs dans l'appli :
  `--nt-content-hover-background` (fond survol), `--nt-text-muted-color`/
  `--nt-text-hover-muted-color` (icône au repos/au survol) — tous correctement
  inversés par mode depuis la Phase 0.

### Phase 7c — Dialog / ConfirmDialog / ConfirmationService

La plus grosse sous-phase de la Phase 7 jusqu'ici (6 fichiers touchés) :
retire `<p-dialog>`, `<p-confirmDialog>` et `ConfirmationService`, en
consommant enfin la primitive `DialogService`/`DialogFrameComponent`
construite (mais jamais utilisée) en Phase 2.

**ConfirmDialog + ConfirmationService** (accueil-trip, trip-detail,
activity-card, notes) :
- `ConfirmDialogService` (`providedIn: 'root'`, `src/app/shared/services/`)
  remplace `ConfirmationService` : un seul singleton pour toute l'appli,
  plutôt qu'un provider par composant hôte comme avant (`accueil-trip` et
  `trip-detail` fournissaient chacun leur propre instance, chacune couplée à
  son propre `<p-confirmDialog />` monté dans le template — nécessaire côté
  PrimeNG puisque le "dialog" n'était qu'un hôte caché en attente d'un
  événement). Avec `DialogService.open()` (CDK), le contenu est créé
  dynamiquement à la demande : plus besoin d'hôte pré-monté nulle part, donc
  plus de `<p-confirmDialog />` dans aucun template, ni de `providers:
  [ConfirmationService]` sur les composants.
- `ConfirmDialogComponent` (contenu, `src/app/shared/components/confirm-dialog/`)
  reçoit son message/header/icône/labels via `DIALOG_DATA`, ferme avec
  `DialogRef.close(true|false)`. `ConfirmDialogService.confirm()` traduit ça
  en `accept()`/`reject()` — une fermeture par Échap/clic extérieur (CDK,
  actif par défaut) ferme avec `undefined`, `!confirmed` route donc
  naturellement vers `reject()`, cohérent avec le seul usage d'un `reject`
  explicite (annulation des dates dans `trip-detail`).
- API calquée sur `ConfirmationService.confirm()` pour un portage 1:1 des 4
  call sites (`message`/`header`/`icon`/`acceptLabel`/`rejectLabel`/`accept`/
  `reject` identiques) : seul `this.confirmationService.confirm(...)` devient
  `this.confirmDialogService.confirm(...)`.
- Labels par défaut "Oui"/"Non" (pas de valeur PrimeNG "Yes"/"No" à
  reproduire : la locale FR du projet, `primelocale/fr.json`, les redéfinit
  déjà ainsi — vérifié directement dans le JSON).

**CollaboratorsDialog** (collaborators-dialog + trip-collaborators) — cas
plus délicat que ConfirmDialog : le dialog n'a pas un contenu figé au
moment de l'ouverture, il reste réactif pendant qu'il est ouvert (liste de
membres qui peut changer en temps réel via Firestore, `addLoading`/
`addError` qui évoluent pendant l'ajout d'un collaborateur). Comme
`DIALOG_DATA` est une valeur transmise une seule fois à l'ouverture (pas un
`@Input()` qui se met à jour), la solution retenue est de transmettre les
**signaux eux-mêmes** (pas leur valeur lue à l'instant `open()`) plus des
callbacks, dans `CollaboratorsDialogData` :
```ts
{ members: Signal<...>, currentUserId: Signal<...>, isOwner: Signal<...>,
  companions: Signal<...>, addLoading: Signal<...>, addError: Signal<...>,
  onAdd, onRemove, onRemoveCompanion }
```
`CollaboratorsDialogComponent` lit `data.members()` etc. dans ses `computed`/
son template exactly comme avant avec ses `input()` — la réactivité continue
de fonctionner malgré le contenu monté hors de l'arbre de vue de
`TripCollaboratorsComponent` (via `cdk-overlay-container`), puisque les
signaux passés restent les MÊMES instances, juste lues depuis un autre
composant. `TripCollaboratorsComponent` garde une référence au `DialogRef`
ouvert pour le refermer lui-même (`dialogRef?.close()`) une fois
`addCollaborator` résolu avec succès — avant, c'était juste
`this.showDialog = false`.

**TimePickerDialog** — cas le plus structurel : contrairement aux deux
précédents, ce composant N'ÉTAIT PAS ouvert par un appelant externe, il
hébergeait directement son `<p-dialog>` dans son propre template (le
composant EST à la fois le déclencheur — la zone cliquable affichant l'heure
— et le contenu). `Dialog.open()` de CDK instancie toujours un composant à
part (pas un `<ng-template>` local) : la logique du cadran (drag, calcul
d'angle, état `tempHour`/`tempMinute`/`selectionMode`) a donc été extraite
telle quelle dans un nouveau composant `TimePickerClockComponent`
(`time-picker-dialog/time-picker-clock/`), ouvert via `DialogService` avec
la date initiale en `DIALOG_DATA` et qui referme avec la date choisie via
`DialogRef.close(date)`. `TimePickerDialogComponent` (fichier d'origine) ne
garde que le déclencheur + le `ControlValueAccessor` — API externe
(`formControlName`/`formControl` dans `activity-form`) strictement
inchangée. Effet de bord positif : deux erreurs de lint préexistantes dans
ce fichier (avant même le début de cette migration) corrigées au passage —
`onChange`/`onTouch` rendus optionnels (`?.()`) au lieu d'assignations de
fonctions vides par défaut, même pattern qu'en Phase 4
(InputNumber/Password).

**Nettoyage connexe** : `--p-*` restants dans les styles propres à ces
composants (`collaborators-dialog.component.scss`,
`time-picker-clock.component.scss`, déplacé depuis
`time-picker-dialog.component.scss`) migrés vers `--nt-*` au passage. CSS
globale morte supprimée de `styles.scss` : `.p-dialog-header/-footer/-content`
(overrides de padding), `.p-confirmdialog.p-dialog` (largeur) — plus aucun
`p-dialog` dans le projet pour les cibler.

Vérifié par `ng build`/`ng lint` (aucune régression, y compris sur les
fichiers non touchés), plus aucun import `primeng/dialog`/
`primeng/confirmdialog`/`ConfirmationService` dans le projet. **Pas de test
de rendu réel dans un navigateur** — phase la plus à risque de régression
visuelle/comportementale jusqu'ici (réactivité cross-composant via signaux
en DIALOG_DATA, split trigger/contenu du time-picker) : mérite un passage
manuel attentif sur les 3 flux avant de continuer.

#### Correctifs post-Phase 7c (trouvés en testant dans le navigateur)

- **Tooltip muette sur un bouton "désactivé pour expliquer pourquoi"**
  (collaborators-dialog, bouton retirer un membre) : `[disabled]` pose
  l'attribut natif `disabled` sur le `<button>` interne, or un élément de
  formulaire disabled ne déclenche plus AUCUN événement souris (y compris
  `mouseenter`), même sur ses ancêtres — coupant le `appTooltip` censé
  justement expliquer pourquoi il est désactivé. `onRemove` revérifiant déjà
  `canRemove` avant d'agir, la désactivation est passée en CSS pur
  (`.member-remove--disabled` : opacité + `cursor:not-allowed`) plutôt que
  via l'attribut natif — confirmé par debug (`console.log` temporaire dans
  `TooltipDirective.show()`) : `mouseenter` se déclenche à nouveau avec le
  bon texte.
- **Padding haut manquant + ascenseur horizontal (puis vertical) sur le
  contenu de tout dialog** : `.dialog-frame__content` reprenait
  l'ancien padding PrimeNG `0 0.5rem 0.5rem 0.5rem` (zéro en haut) →
  uniformisé à `0.5rem`. Ascenseur horizontal : `overflow-y:auto` sans
  `overflow-x` explicite fait calculer ce dernier à `auto` par la spec CSS
  dès que l'un des deux axes n'est pas `visible` → `overflow-x:hidden`
  ajouté explicitement. `min-width:0` ajouté sur `:host`/`.dialog-frame`
  (`<app-dialog-frame>` est un flex item direct de `.cdk-overlay-pane`, dont
  le `min-width:auto` par défaut l'empêchait de rétrécir sous la largeur
  intrinsèque de son contenu).
- **Gap disparu entre les boutons du footer** : `<div dialogFooter>` (au
  lieu d'un simple élément par bouton) devient l'UNIQUE enfant flex de
  `.dialog-frame__footer` — son `gap` n'a alors plus rien entre quoi
  s'appliquer. `<ng-container dialogFooter>` à la place : pas de nœud DOM
  emballant, les boutons redeviennent des enfants flex directs.
- **"Non" quasi invisible en light mode** : `[text]="true"` (pas de fond, pas
  de bordure) pour un bouton secondaire de premier plan dans un dialog se lit
  comme "rien" plutôt que comme un bouton. Remplacé par `[outlined]="true"`,
  la convention déjà utilisée par le bouton "Fermer" de collaborators-dialog.
- **Dialog pleine largeur/hauteur, sans marge (surtout visible sur
  ConfirmDialog, contenu court)** : `.cdk-overlay-pane` (overlay-prebuilt.css)
  pose déjà `max-width:100%`/`max-height:100%` — même spécificité qu'un
  simple `.app-dialog-panel` (une classe chacun). En dev (`ng serve`),
  l'ordre d'injection des styles ne respecte pas forcément l'ordre du
  tableau `styles` d'angular.json : confirmé empiriquement (DevTools) que
  `max-width:100%` de `.cdk-overlay-pane` l'emportait sur notre propre
  `max-width`. Corrigé en ciblant le sélecteur composé
  `.cdk-overlay-pane.app-dialog-panel` (deux classes, spécificité plus
  élevée, gagne indépendamment de l'ordre de chargement) — au passage,
  `95vw`/`85vh` (marge en % de viewport, qui rétrécit vers zéro sur un petit
  écran) remplacés par `min(28rem, calc(100vw - 2rem))`/
  `calc(100vh - 2rem)` (marge minimale constante de 1rem, quelle que soit la
  taille d'écran).
- **La bulle native du navigateur ("Collaborateurs") s'affichait au survol
  au lieu du `appTooltip`** : `<app-dialog-frame title="Collaborateurs">`
  (attribut statique, sans crochets) — Angular écrit un attribut statique
  tel quel sur l'élément DOM hôte EN PLUS d'initialiser l'input du même nom.
  Comme `title` est un attribut HTML global reconnu par le navigateur (bulle
  native au survol de l'élément ET de ses descendants sans tooltip propre),
  ça faisait apparaître la bulle native du navigateur — masquant/perturbant
  `appTooltip` sur les boutons à l'intérieur du dialog. Input renommé
  `title` → `header` (même nom que `PanelComponent`) dans
  `DialogFrameComponent` : `header` n'a aucune signification spéciale pour
  le navigateur, plus aucun risque de collision.
- **Curseur "pointer" au lieu de "not-allowed" sur le bouton de suppression
  désactivé visuellement** : le correctif `[disabled]` → classe CSS (voir
  plus haut) posait `cursor:not-allowed` sur le HOST `<app-button>`, mais le
  `<button>` NATIF à l'intérieur a sa propre règle explicite
  `cursor:pointer` (`.app-button`) — une règle explicite sur l'élément
  lui-même gagne toujours sur une valeur seulement héritée d'un ancêtre,
  peu importe où elle est posée. Généralisé proprement dans
  `ButtonComponent` : nouvel input `ariaDisabled` (pattern standard
  `aria-disabled` du web, distinct de `disabled` natif) qui pose la classe
  `.app-button--aria-disabled` DIRECTEMENT sur le `<button>` interne (même
  traitement visuel que `:disabled` — opacité, `cursor:not-allowed` — mais
  sans bloquer les événements souris). `collaborators-dialog` utilise
  maintenant `[ariaDisabled]="!canRemove(entry[0])"` au lieu d'une classe
  ad hoc locale ; réutilisable pour tout futur bouton "désactivé mais dont
  il faut expliquer pourquoi via une tooltip".
- **Tooltip invisible (mais bien présente dans le DOM, bien positionnée) au
  survol d'un bouton À L'INTÉRIEUR d'un dialog** — le correctif le plus
  significatif de cette phase, avec une implication qui dépasse le tooltip.
  Diagnostiqué par inspection DevTools en direct (position `fixed` confirmée,
  boîte réelle 165×73.5px, bonne couleur, `window.innerHeight` largement
  suffisant — donc ni un problème de `position`, ni de calcul de coordonnées,
  ni de viewport trop petit) : **`@angular/cdk/overlay` pose par défaut
  `popover="manual"` sur ses panneaux** (`usePopover` vrai par défaut dans
  `createOverlayRef`, si le navigateur supporte l'API Popover), ce qui les
  place dans le **"top layer"** natif du navigateur. Un élément du top layer
  s'affiche TOUJOURS au-dessus du document normal, quel que soit son
  z-index — un `<div>` classique, même avec `z-index: 999999 !important`
  (testé), ne peut structurellement jamais passer au-dessus d'un panneau CDK.
  `TooltipDirective` pose donc elle aussi `popover="manual"` sur sa bulle
  (avec repli sur le comportement `position:fixed` classique si l'API n'est
  pas supportée par le navigateur) : elle rejoint le même top layer, où
  l'ordre d'empilement suit l'ordre d'affichage — ouverte après le dialog,
  elle passe naturellement au-dessus. Le style UA par défaut d'un `[popover]`
  (`inset:0`, `margin:auto`, `border:solid`, `overflow:auto`) est neutralisé
  dans `tooltip.scss` (`&:popover-open { inset:auto; margin:0; border:none;
  overflow:visible; }`) pour ne pas entrer en conflit avec le positionnement
  `top`/`left` calculé en JS.
  **Implication pour la suite de la Phase 7** (Select 7d, AutoComplete 7e,
  DatePicker 7f) : tout futur overlay maison qui doit pouvoir s'afficher
  par-dessus un `Dialog`/`Menu` CDK (ou l'inverse) devra soit lui aussi
  utiliser `popover`, soit passer par `@angular/cdk/overlay` directement
  (qui gère déjà `usePopover`) plutôt que par un `<div>` `position:fixed`
  fait main — le z-index seul ne suffit structurellement plus dès qu'un
  panneau CDK est dans la course.

### Phase 7d — Select

Trois usages (activity-form : type, statut de réservation, devise) — le
quatrième consommateur repéré dans l'audit initial (`timeline`) importait
`SelectModule` sans jamais utiliser `<p-select>` dans son template : import
mort retiré au passage, aucun composant réel à migrer là.

`SelectComponent` (`src/app/shared/components/select/`) construit sur
`@angular/cdk/overlay`, exactement comme `MenuComponent` (Phase 7b) et pour
la même raison (rejoint le "top layer" via `popover`, actif par défaut sur
les overlays CDK — voir la découverte documentée juste au-dessus). API
volontairement simplifiée par rapport à `p-select` : un seul format
d'options `{label, value}[]` (aucun des 3 usages ne personnalisait
`optionLabel`/`optionValue`), donc pas besoin de les rendre configurables.

- **Desktop vs mobile** : l'ancien `p-select` devenait un tiroir plein écran
  ancré en bas sur mobile via ~120 lignes de CSS ciblant les internes de
  PrimeNG (`.p-overlay:has(.p-select-overlay)`, `.p-overlay-content:has(>
  .p-select-overlay)`..., voir l'historique de `styles.scss`). Remplacé par
  un choix de `positionStrategy` CDK fait à l'OUVERTURE selon
  `ViewportService.isMobile()` (même breakpoint 768px que l'ancien
  `[touchUI]`, évalué au même instant précis — pas une media query CSS
  live) : `flexibleConnectedTo` ancré sous le champ en desktop,
  `global().centerHorizontally().bottom('0')` + `width:'100%'` en mobile.
  Le contenu (liste d'options) est un unique `<ng-template>`/`TemplatePortal`
  partagé par les deux variantes ; seul le `panelClass`
  (`app-select-overlay--desktop`/`--mobile`) change l'habillage visuel via
  CSS.
- **Fermeture** : `hasBackdrop:true` + `backdropClick()`/`keydownEvents()`
  (Échap) gérés par CDK directement, comme `MenuComponent` — contrairement à
  `p-select`, `SelectComponent` n'a donc plus besoin de s'enregistrer auprès
  d'`OverlayAutoCloseService` (mécanisme construit à l'origine pour
  coordonner la fermeture de plusieurs overlays PrimeNG indépendants qui ne
  se voyaient pas entre eux — non nécessaire ici, CDK gère déjà un seul
  overlay backdrop-aware à la fois proprement). `OverlayAutoCloseDirective`
  simplifiée en conséquence : ne couvre plus que `p-datepicker` (sélecteur
  réduit de `'p-select, p-datepicker'` à `'p-datepicker'`, branche `Select`
  retirée), jusqu'à la Phase 7f.
- **Fond flouté mobile** : `backdropClass: 'app-select-backdrop--mobile'`
  (nouveau, `src/styles/select.scss`, global — même topologie que
  `.app-dialog-backdrop` : le backdrop CDK est ajouté dans
  `.cdk-overlay-container`, hors de l'arbre de vue du composant) remplace
  l'ancien pseudo-élément `body:has(> .p-overlay .p-select-overlay)::after`.
- **`.compact-form`** (activity-form, densité des 3 selects dans une carte
  déjà bordée) : `.p-select-label`/`.p-select-dropdown` remplacés par
  `.app-select__trigger`/`.app-select__chevron` dans `styles.scss`. La
  variante sans bordure (`.transparent-select`, gardait le même nom de
  classe dans les templates) est réécrite en `:host(.transparent-select)`
  DANS `select.component.scss` plutôt que via des `--p-select-*` globales
  dans `styles.scss` — n'existe plus comme jeu de custom properties à
  cibler côté PrimeNG.
- **Couleur du statut de réservation** (`[ngClass]="'booking ' +
  bookingMeta().className"`, teinte le champ selon à-réserver/réservé/...) :
  `:host ::ng-deep .booking .p-select-label` dans
  `activity-form.component.scss` remplacé par `:host(.booking)
  .app-select__label` DANS `select.component.scss` — plus besoin de
  `::ng-deep` du tout, `:host(.classe)` cible directement le host depuis le
  style scopé du composant qui la reçoit (même pattern que Tag/Message/
  Avatar en Phase 3). `--p-red-500`/`--p-green-500`/`--p-blue-500`/
  `--p-yellow-500` (couleurs des 4 statuts, `.to_book`/`.booked`/
  `.not_needed`/`.waitlist` dans `styles.scss`) migrés vers
  `--nt-red-500`/`--nt-green-500`/`--nt-blue-500`/`--nt-yellow-500` au
  passage.
- Nettoyage connexe : le forçage de zIndex sur `.p-select-overlay`/
  `.p-overlay:has(.p-select-overlay)` dans `styles.scss` (nécessaire pour
  PrimeNG, dont le zIndex dynamique pouvait tomber sous le chrome fixe de
  l'appli) supprimé — plus d'objet, `app-select` hérite du z-index CDK
  (1000) déjà au-dessus de ce chrome.

Vérifié par `ng build`/`ng lint` (aucune régression), plus aucun
`<p-select>`/import `primeng/select` dans le projet (seul le chunk lazy de
`trip-detail-component` a nettement rétréci : 947 Ko → 760 Ko). **Pas de
test de rendu réel dans un navigateur** — le tiroir mobile en particulier
(recréé from scratch, pas juste porté) mérite un passage attentif sur les 3
selects, desktop ET mobile, avant de continuer.

#### Correctif post-Phase 7d (trouvé en testant dans le navigateur)

- **Panneau déroulant sans fond ni bordure** : `.app-select-overlay--{desktop,
  mobile} .app-select-panel` (et les règles associées : `.app-select-panel__list`,
  `.app-select-panel__option`) vivaient dans `select.component.scss`, la
  feuille de style SCOPÉE du composant. Or `.app-select-panel` (le contenu du
  panneau) est attaché par `@angular/cdk/overlay` dans
  `.cdk-overlay-container`, **hors de l'arbre de vue du composant** (portail) —
  exactement la même topologie que `.app-dialog-panel`/`.app-tooltip`, qui
  vivent déjà dans des feuilles GLOBALES (`dialog.scss`, `tooltip.scss`) pour
  cette raison précise, mais oubliée pour `app-select`. Combiner
  `.app-select-overlay--desktop`/`--mobile` (classe ajoutée par CDK via
  `panelClass`, donc SANS l'attribut d'encapsulation `_ngcontent-*` de ce
  composant) avec `.app-select-panel` (élément du composant, WITH cet
  attribut) dans une même règle scopée ne matche pas de façon fiable — d'où
  le panneau rendu sans aucun style. Toutes les règles concernant
  `.app-select-panel*`/`.app-select-overlay--*` déplacées vers
  `src/styles/select.scss` (déjà global, y vivait déjà le fond flouté
  mobile) ; ne reste dans `select.component.scss` que ce qui appartient
  réellement à la vue du composant (`.app-select__trigger`/`__label`/
  `__chevron`, `:host(.transparent-select)`, `:host(.booking)`).
- **Tiroir mobile : pas plein écran, texte non centré, pas de scroll/hauteur
  maximum, sélection courante invisible** (4 correctifs groupés, tous
  `src/styles/select.scss`) :
  - Largeur : `.cdk-overlay-pane` reçoit bien `width:100%` (posé par CDK via
    `OverlayConfig.width`), mais `.app-select-panel` à l'intérieur — un flex
    item de ce pane, sizing par défaut = largeur de son contenu — ne s'étire
    pas tout seul pour la remplir. `width:100%` ajouté explicitement dessus.
  - Centrage : `justify-content:center; text-align:center;` ajouté sur
    `.app-select-overlay--mobile .app-select-panel__option`.
  - Scroll/hauteur : `max-height`/`overflow-y:auto` posés uniquement sur
    `.app-select-panel__list` dépendaient d'une hauteur de panneau non
    bornée par défaut. Repris le même schéma flex que l'ancien CSS PrimeNG
    (`.p-overlay:has(.p-select-overlay)` + `> p-motion`) : `max-height:85vh`
    + `display:flex;flex-direction:column` sur `.app-select-panel`
    lui-même, `flex:1 1 auto;min-height:0` sur `.app-select-panel__list`.
  - Sélection courante : `.app-select-panel__option--selected` ne changeait
    que la couleur du texte — peu visible, surtout centré (moins de poids
    visuel qu'aligné à gauche à côté d'une puce). Fond teinté ajouté
    (`color-mix` avec `--nt-primary-color`), commun aux deux variantes.

### Phase 7e — AutoComplete

Deux usages (activity-header : titre d'activité + recherche Google Places ;
new-trip : ville/pays du voyage). `AutoCompleteComponent`
(`src/app/shared/components/autocomplete/`) construit sur
`@angular/cdk/overlay` comme `SelectComponent`/`MenuComponent` (mêmes
raisons : top layer), avec la leçon de la Phase 7d appliquée dès le départ
— le style du panneau (`.app-autocomplete-panel*`) vit directement dans
`src/styles/autocomplete.scss` (global), jamais dans une feuille scopée au
composant.

Différence de fond avec `Select` : la valeur est un texte **libre** (CVA sur
une chaîne saisie, pas une valeur choisie dans une liste fermée) — pas de
bouton déclencheur, le panneau s'ouvre à la frappe et se ferme au flou du
champ (`hasBackdrop: false`, pas besoin de bloquer le reste de la page pour
un champ de recherche texte ; contrairement à `Select`/`Menu`, pas de
fermeture CDK backdrop/Échap ici — Échap géré manuellement au clavier).
`(mousedown)="$event.preventDefault()"` sur chaque option : sans ça, cliquer
une suggestion fait D'ABORD perdre le focus au champ (donc fermer le
panneau) AVANT que le `click` n'ait la moindre chance de se déclencher —
piège classique de tout autocomplete input+liste, contourné en empêchant le
comportement de focus par défaut du `mousedown`.

- **Contenu des options personnalisable, sans rien changer côté appelant** :
  les deux usages ont chacun leur propre `<ng-template #item let-place>`
  (adresse en plus du nom pour activity-header, nom seul en grand pour
  new-trip). `contentChild<TemplateRef<...>>('item')` retrouve cette
  référence de template locale exactement comme le faisait `p-autoComplete`
  en interne — templates des deux consommateurs inchangés au caractère près.
- **`field="name"` → `[displayWith]`** : plutôt qu'un nom de propriété
  (supposant implicitement que l'option est un objet plat), un input
  `displayWith: (item: T) => string` — activity-header lui passe sa méthode
  `displayName` existante (qui gérait déjà la normalisation défensive du nom
  Google Places), new-trip une nouvelle petite méthode `displayPlaceName`.
- **Sorties renommées `searched`/`blurred`** (pas `search`/`blur`) :
  `@angular-eslint/no-output-native` interdit de nommer un output comme un
  événement DOM natif — piège sur lequel je suis moi-même tombé en écrivant
  le composant (`search` rattrapé par le lint, `blur` évité dès le départ
  pour la même raison, documentée dans le composant).
- **`inputClass`** (même pattern que `InputNumberComponent.inputClass`,
  Phase 4) : activity-header en avait besoin pour le style particulier du
  titre (`font-semibold p-0 text-base`), perdu sinon puisque
  `app-autocomplete` ne connaît pas `[inputStyleClass]`.
- Nettoyage connexe : `.transparent-autocomplete` (ciblait
  `--p-autocomplete-*`) supprimée de `styles.scss`, devenue sans objet
  (`app-autocomplete` utilise déjà `.transparent-inputtext`/
  `--nt-form-field-*`, comme les autres champs) ; `panelStyleClass=
  "autocomplete-panel-fix"` retiré au passage (ciblait une classe déjà morte,
  jamais stylée dans le projet).

Vérifié par `ng build`/`ng lint` (aucune régression), plus aucun
`<p-autoComplete>`/import `primeng/autocomplete` dans le projet. **Pas de
navigation clavier dans les suggestions** (flèches haut/bas + Entrée,
gérées nativement par PrimeNG) — non reproduite, jugée hors scope vu
l'ampleur déjà importante de cette phase ; à ajouter si le besoin remonte.

#### Correctif post-Phase 7e (trouvé en testant dans le navigateur)

- **`TypeError` au clic sur une suggestion (activity-header)** :
  `displayName(place)` (utilisée à la fois dans le template ET passée par
  RÉFÉRENCE à `[displayWith]`) était une méthode ordinaire appelant
  `this.extractPlaceName(...)`. Passée en tant que VALEUR (pas appelée) à
  `[displayWith]`, elle perd son `this` d'origine dès qu'`AutoCompleteComponent`
  l'invoque plus tard elle-même (`this.displayWith()(option)`) — `this`
  redevient `undefined` en interne, `this.extractPlaceName` casse. Corrigé
  en `displayName` fonction fléchée (propriété de classe, pas méthode de
  prototype) : capture `this` lexicalement une fois pour toutes, reste
  valide peu importe comment/où elle est appelée par la suite. Piège
  classique de tout callback passé par référence depuis un template Angular
  — `displayPlaceName` (new-trip) y échappait par chance, ne touchant jamais
  `this` dans son corps.

**Pas de test de rendu réel dans un navigateur** au-delà de ce correctif.

### Phase 7f — DatePicker

Dernière sous-phase de la Phase 7 : trois usages (new-trip : dates de voyage
en plage ; trip-header : même plage, réédition ; activity-form : deadline de
réservation en date simple). `DatePickerComponent`
(`src/app/shared/components/date-picker/`) construit sur
`@angular/cdk/overlay` comme `Select`/`AutoComplete`/`Menu` (même raison : top
layer). Première (et seule) nouvelle dépendance de toute la migration :
`date-fns` (calcul de grille de mois/semaines/comparaisons de dates), comme
prévu dès le début dans les "Décisions retenues" — tout le rendu/
l'interaction du calendrier restent maison, la lib ne fait que le calcul.

- **Un seul composant pour les deux modes** (`[range]` booléen, défaut
  `false`) plutôt que deux composants séparés : la seule différence entre
  "deadline" (simple) et "dates de voyage" (plage) est la forme de la valeur
  CVA (`Date | null` vs `Date[] | null` à 2 éléments, même forme
  `[dateDebut, dateFin]` qu'avant) et la logique de clic sur un jour — le
  rendu du calendrier (grille, navigation mois, styles) est identique dans
  les deux cas.
- **Mode plage, logique de clic** : 1er clic pose le début (`rangeEnd` remis
  à `null`) ; si la plage précédente était déjà complète, un nouveau clic
  repart toujours d'une plage vide plutôt que d'étendre l'ancienne (repris du
  comportement PrimeNG). 2e clic complète la plage dans l'ordre
  chronologique (peu importe l'ordre des clics, via `isBefore`) et ferme le
  panneau. `onChange`/l'output `selected` ne sont déclenchés qu'une fois la
  plage complète — jamais avec un seul bout — exactement le contrat que
  lisait déjà l'ancien `onDatesSelected()` de `TripHeaderComponent`
  (`if (!dates[0] || !dates[1]) return`), donc aucun changement côté
  appelant au-delà du renommage `(onSelect)` → `(selected)`.
- **Aperçu au survol en mode plage** : `hoveredDay` signal, mis à jour au
  `mouseenter` de chaque jour, lu par `isRangeEnd`/`isInRange` tant que
  `rangeEnd` n'est pas encore posé — reproduit le surlignage "plage en cours
  de sélection" que PrimeNG offre nativement, pour ne pas perdre ce repère
  visuel en passant au composant maison.
- **Desktop vs mobile**, même stratégie que `Select`/`AutoComplete` (Phases
  7d/7e) : `positionStrategy` choisi à l'OUVERTURE selon
  `ViewportService.isMobile()`. Contrairement au tiroir plein écran ancré en
  bas de `Select`, le mobile ici est **centré à l'écran**
  (`global().centerHorizontally().centerVertically()`) — reproduit le
  comportement `[touchUI]` de l'ancien `p-datepicker` (voir l'historique de
  `styles.scss`, bloc `@media (max-width:768px)` avec
  `transform: translate(-50%,-50%)` sur `.p-datepicker-panel`) : un
  calendrier a besoin de sa hauteur naturelle, pas de s'étirer en bas
  d'écran comme une liste d'options.
- **Panneau dans une feuille globale dès le départ**
  (`src/styles/date-picker.scss`) : leçon de la Phase 7d appliquée d'emblée
  (le panneau est attaché par CDK dans `.cdk-overlay-container`, hors de
  l'arbre de vue du composant — un style scopé au composant ne peut pas le
  cibler de façon fiable, voir le correctif documenté en Phase 7d).
- **Trigger en `<button>`, pas `<input readonly>`** : comme `Select`, pas
  comme `AutoComplete` (dont la valeur est un texte libre) — les trois
  usages avaient déjà `[readonlyInput]="true"` côté PrimeNG (aucune saisie
  clavier), un bouton évite nativement toute ouverture de clavier virtuel
  sur mobile, sans code de blocage supplémentaire à écrire (cf. l'item déjà
  coché du ROADMAP "Clavier masqué sur les datepickers").
- **`Fluid` supprimé de `new-trip.component.html`** (`<p-fluid>` + import
  `FluidModule`), reporté depuis la Phase 4 : il ne servait qu'à étirer
  `p-autoComplete`/`p-datepicker` à 100% de largeur en CSS ; `app-autocomplete`
  et `app-date-picker` sont déjà `width:100%` par défaut (`:host`), le
  wrapper est donc devenu un no-op pur.
- **`OverlayAutoCloseService`/`OverlayAutoCloseDirective` supprimés en
  entier** (`src/app/core/services/`, `src/app/shared/directives/`) :
  `p-datepicker` en était le dernier consommateur (`p-select` en était sorti
  dès la Phase 7d) — `app-date-picker` gère sa propre fermeture nativement
  via le backdrop/Échap CDK, comme tous les autres overlays maison de la
  Phase 7. Le mécanisme de coordination cross-overlay que ce service
  résolvait (deux `p-select`/`p-datepicker` PrimeNG indépendants qui ne se
  fermaient pas l'un l'autre) n'a plus d'objet une fois qu'un seul système
  d'overlay (CDK) gère tout.
- Nettoyage connexe dans `styles.scss` : tout le bloc mobile
  `.p-datepicker-mask`/`.p-datepicker-panel` (repositionnement centré,
  anti-ghost-click), le forçage de zIndex sur ces mêmes sélecteurs, le bloc
  `p-motion[name="p-anchored-overlay"]:has(> .p-datepicker-panel)`, et
  `.transparent-datepicker` (remplacée par `.transparent-inputtext`, déjà
  utilisée par tous les autres champs migrés) — plus aucun `p-datepicker`
  dans le projet pour les cibler.

Vérifié par `ng build`/`ng lint` (aucune régression, aucune nouvelle erreur —
les 6 erreurs de lint restantes préexistaient et concernent des fichiers non
touchés par cette phase), plus aucun `<p-datepicker>`/`<p-fluid>`/import
`primeng/datepicker`/`primeng/fluid` dans le projet. Testé en navigateur via
une route de dev jetable (auth Firebase requise sur les vraies routes
`/trips/*`, inaccessible en session non interactive) montée avec
`Playwright`/Chromium headless, supprimée une fois la vérification faite :
sélection de plage (survol, clôture au 2e clic), mode simple, ancrage
desktop, centrage mobile, dark mode — aucune erreur console.

#### Correctifs post-Phase 7f (trouvés en testant dans le navigateur)

- **Hauteur du panneau qui sautait d'un mois à l'autre** : la grille des
  jours calculait ses semaines "naturellement"
  (`startOfWeek(monthStart)` → `endOfWeek(endOfMonth(monthStart))`), ce qui
  donne 4, 5 ou 6 lignes selon que le mois commence/finit pile sur une
  limite de semaine (février qui tient en 4 lignes complètes, contre 6 pour
  un mois de 31 jours qui déborde des deux côtés). Résultat : la hauteur du
  panneau changeait visiblement en changeant de mois via précédent/suivant.
  Corrigé en calculant TOUJOURS 42 jours consécutifs depuis `gridStart`
  (`eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) })`),
  jamais moins — 6 semaines fixes quel que soit le mois affiché.
- **Mois manquant : navigation directe année/mois** : le titre du panneau
  n'était au départ qu'un unique bouton, zoomant vers la grille des mois
  puis celle des années en cliquant deux fois de suite dessus (chaînage
  unique). Repensé en `viewMode` (`'days' | 'months' | 'years'`) avec, en
  vue jours, le mois et l'année comme **deux boutons indépendants** menant
  chacun à un niveau de zoom différent : cliquer sur le MOIS ouvre
  directement la grille des 12 mois (choisir un mois revient directement à
  la grille des jours, sans détour par les années) ; cliquer sur l'ANNÉE
  ouvre directement la grille de 12 années (choisir une année enchaîne vers
  la grille des mois de ce nouveau millésime, qui revient elle-même aux
  jours une fois un mois choisi). Le titre de la vue mois (l'année seule)
  reste cliquable vers la vue années, pour un zoom progressif classique en
  plus des deux raccourcis directs. Grilles mois/années en 2 colonnes × 6
  lignes (au lieu du 3×4/4×3 "naturel" pour 12 éléments) pour que basculer
  entre les 3 vues du même panneau ne fasse pas non plus sauter sa taille.
- **Sélection ronde** : mode simple (un jour) en cercle complet
  (`border-radius: 50%`) plutôt que le léger rayon (`--nt-radius-sm`, 4px)
  utilisé partout ailleurs dans l'appli. Mode plage : seul le bord EXTÉRIEUR
  de chaque extrémité est arrondi en demi-cercle
  (`50% 0 0 50%`/`0 50% 50% 0` pour `range-start`/`range-end`), le bord
  intérieur (qui touche le remplissage `--in-range`, resté à `border-radius:
  0`) reste droit — ça forme une seule barre continue à bouts ronds plutôt
  que 2 pastilles séparées par un espace visuel. Cas particulier : une plage
  d'un seul jour (`range-start` ET `range-end` sur la même case) aurait
  cumulé les 2 règles en un rond arrondi seulement de 2 coins sur 4 — rond
  complet explicite via le sélecteur combiné
  `.range-start.range-end { border-radius: 50%; }`, qui gagne sur les 2
  règles simples par spécificité CSS (2 classes vs 1). Le rond "aujourd'hui"
  (`box-shadow: inset`) suit désormais aussi `border-radius: 50%` — un
  `inset` respecte le rayon de SON PROPRE élément, donc le jour du jour
  actuel affiche un anneau rond même sans être sélectionné, cohérent avec la
  sélection elle-même.

## Après la migration

- Désinstaller `primeng`, `@primeuix/themes`, `primelocale`, `primeflex`,
  `primeicons` de `package.json`.
- Retirer les entrées `styles` correspondantes dans `angular.json`.
- Retirer `providePrimeNG` et la config `theme`/`translation` de `app.config.ts`.
