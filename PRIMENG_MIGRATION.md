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
| 6 | `Tabs` maison + mise à jour de `cloneNavBarInto` dans `ActivityDayDispatchOverlayComponent` (voir piège ci-dessus) | Moyen | À faire |
| 7 | Overlays complexes sur la primitive `Dialog` de la Phase 2 (+ `@angular/cdk/menu`/`listbox` pour Select/Menu) : Menu, Tooltip, `ConfirmDialog` + `ConfirmationService` maison, Select, AutoComplete (recherche Google Places), DatePicker (lib headless + UI maison) | Élevé | À faire |
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
| Fluid | new-trip | 4 (suppression) |
| Panel | activity-card, activity-google-info, activity-gallery, trip-activities, notes, timeline, day-panel, trip-day-map | 5 |
| Tabs / Tab / TabList | trip-tabs-nav (+ clone dans activity-day-dispatch-overlay) | 6 |
| Menu / MenuItem | trips (roue crantée) | 7 |
| Tooltip | accueil-trip, collaborators-dialog, trip-collaborators | 7 |
| Dialog / ConfirmDialog / ConfirmationService | time-picker-dialog, collaborators-dialog, accueil-trip, trip-detail, activity-card, notes | 7 |
| Select | activity-form, timeline | 7 |
| AutoComplete | new-trip, activity-header | 7 |
| DatePicker | new-trip, trip-header, activity-form | 7 |
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

## Après la migration

- Désinstaller `primeng`, `@primeuix/themes`, `primelocale`, `primeflex`,
  `primeicons` de `package.json`.
- Retirer les entrées `styles` correspondantes dans `angular.json`.
- Retirer `providePrimeNG` et la config `theme`/`translation` de `app.config.ts`.
