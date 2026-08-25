---
name: nesttrip-ux-desktop
description: Décliner l'UI mobile de NestTrip en maquettes desktop puis tablette — audit de l'existant, principes de design "premium" (DESIGN.md), et méthode pour produire des maquettes HTML/CSS fidèles (Artifact) avant tout code Angular réel. À utiliser dès qu'on parle de "maquette", "desktop", "UI Desktop" (ROADMAP.md), déclinaison tablette, ou refonte visuelle d'un écran existant.
---

# Décliner l'UI mobile de NestTrip en desktop/tablette

Rôle à endosser pour cette skill : Senior Product Designer + Front-end Engineer, direction "premium minimaliste" — le même brief que `DESIGN.md` à la racine (mélange Apple / Linear / Notion Mobile / Google Maps / Polarsteps / Flighty). Le lire si besoin de se remémorer le ton voulu : beaucoup d'espace, hiérarchie visuelle forte, animations discrètes, ombres douces, jamais de glassmorphism.

Item roadmap concerné : `ROADMAP.md` → "### UI spécifique Desktop (A affiner)".

## 1. Ne pas repartir de zéro — un layout desktop existe déjà en partie

Avant de dessiner quoi que ce soit, vérifier ce qui est déjà en place plutôt que de le réinventer :

- **`ViewportService`** (`src/app/core/services/ui/viewport.service.ts`) définit les breakpoints réels de l'app — il n'y a **pas** de grille `@media (min-width)` générique façon design system, les breakpoints sont ciblés :
  - `MOBILE_QUERY = (max-width: 768px)` → `isMobile()`.
  - `SPLIT_LAYOUT_QUERY = (orientation: landscape) and (min-width: 700px)` → **le** déclencheur du layout scindé desktop (carte épinglée à gauche, contenu à droite) — déjà branché sur la vue Jour (`day-panel.component.scss`, `day-logistic-banner.component.scss`).
  - `CHROME_PINNED_QUERY` (idem + `min-height: 500px`) → chrome (toolbar + barre d'onglets) toujours visible plutôt que hide-on-scroll.
  - `TOUCH_QUERY = (pointer: coarse)` → **décisif** : un device tactile large/paysage reste en "chrome mobile" même au-delà de 700px. Un vrai desktop (pointeur fin) bascule en layout scindé même redimensionné étroit. Ne jamais raisonner en largeur seule pour "desktop vs mobile" dans ce projet.
- **`TripChromeService`** expose `ChromeMode`: `'mobile'` / `'split-hideable'` / `'split-pinned'` — piloter les maquettes sur ces 3 états, pas juste "mobile/desktop".
- **Déjà scindé (vue Jour uniquement)** : carte à gauche (colonne libre, `flex:1 1 auto`, hauteur `calc(100dvh - offset - 1.5rem)`), timeline + bandeau logistique + liste d'activités à droite (`flex:0 1 32rem`, plafonnée). Barre d'onglets jours en haut (`app-trip-tabs-nav`, fixe) au lieu de la barre du bas mobile (`app-mobile-trip-nav`).
- **Rien de scindé (le vrai chantier)** : les 4 sous-onglets "Général" (`trip-summary`, `trip-activities`, `notes`, `logistics-list`) sont une simple colonne centrée à `--nt-content-max-width` (40rem), zéro `@media` dans leurs `.scss` — c'est exactement "refondre toute la partie générale" de la roadmap. Idem "vue calendrier" (n'existe nulle part) et le hover des boutons texte (`.app-button--text:hover` utilise un wash primary 12% — cf. `button.component.scss` — la roadmap demande "un truc plus doux").

**Conséquence pratique** : une maquette desktop doit *étendre* `SPLIT_LAYOUT_QUERY`/`ChromeMode`, jamais introduire un 2ᵉ système de breakpoints parallèle.

## 2. Méthode : mobile → desktop → tablette, en maquettes HTML/CSS réelles

L'utilisateur veut des maquettes visuelles avant tout code Angular — format : **Artifact HTML/CSS interactif**, pas de wireframe abstrait. Charger la skill `artifact-design` avant d'écrire le fichier (obligatoire, cf. sa description).

1. **Extraire les tokens réels à chaque maquette**, ne pas les recopier de mémoire (ils dérivent, `tokens.scss` est la source de vérité) : lire `src/styles/tokens.scss` pour les valeurs `--nt-*` du moment (palette, radius, ombres, couleurs de type activité/logistique) et les injecter telles quelles dans le CSS de l'artifact, avec le bloc `@media (prefers-color-scheme: dark)` correspondant (le projet supporte les deux modes nativement).
2. **Reproduire l'anatomie réelle des composants**, pas une réinterprétation :
   - `app-card`/`app-panel` : `--nt-content-border-radius` (0.5rem), `--nt-shadow-xs` au repos, `app-panel` a une vraie bordure hairline, `app-card` non.
   - Carte activité/logistique : barre d'accent en dégradé (`::before`, `--nt-card-accent-bar-width` 0.4rem, couleur de type → 55% opacité), pas une simple bordure pleine.
   - Timeline : rail avec badges circulaires teintés à 16% de la couleur du type, séparateurs `app-divider` légers.
   - Voir `CLAUDE.md` pour les patterns store/repository — non pertinents ici, mais rappeler qu'une maquette ne touche jamais au code Angular réel (TripStore, mappers...).
3. **Décliner dans cet ordre** : (a) inventaire des composants desktop (boutons, cards, panels, tags, chips) — sert de mini design-system de référence ; (b) composition d'écrans desktop réels (vue Jour affinée, "Général" refondu, vue calendrier) ; (c) déclinaison tablette des mêmes écrans à un breakpoint intermédiaire (probablement entre `MOBILE_QUERY` et `SPLIT_LAYOUT_QUERY` — à trancher avec l'utilisateur si ambigu, cf. §3).
4. Une maquette = un point de départ pour discussion, pas une décision. Présenter, itérer par retours de l'utilisateur avant de coder quoi que ce soit en Angular.

## 3. Ne jamais deviner un choix UX ambigu

Même règle que `nesttrip-roadmap` : si une maquette implique un choix de disposition/interaction non tranché (ex. répartition des 4 sous-onglets Général en colonnes, comportement de la vue calendrier, breakpoint exact tablette), poser la question via `AskUserQuestion` avec des options concrètes plutôt que de trancher seul. Rappel de la philosophie produit : simplicité, pas de nouveau réglage/toggle pour résoudre un problème de layout.

## 4. Documenter les décisions

Une fois une direction de maquette validée par l'utilisateur, la consigner dans `ROADMAP.md` (section "UI spécifique Desktop", même style que les autres décisions actées) avant de commencer l'implémentation Angular réelle — pas seulement dans la conversation ou dans l'artifact (qui reste une référence visuelle, pas la source de vérité du plan).

## 5. Passage au code réel

Les maquettes ne sont jamais du code de prod : une fois une direction validée, l'implémentation Angular repasse par `nesttrip-roadmap` (détailler l'item, respecter les patterns `CLAUDE.md`) puis `nesttrip-verify` avant de considérer quoi que ce soit terminé.
