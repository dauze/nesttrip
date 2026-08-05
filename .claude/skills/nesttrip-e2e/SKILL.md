---
name: nesttrip-e2e
description: Tests e2e Playwright pour NestTrip — comment lancer la suite, utiliser le compte de test dédié, parcours déjà couverts vs backlog. À utiliser quand on écrit/étend un parcours e2e, ou quand nesttrip-verify demande de faire tourner la suite e2e pour un changement touchant un parcours déjà couvert.
---

# Tests e2e (NestTrip, Playwright)

Périmètre débloqué le 2026-07-28 (était "en pause" dans `ROADMAP.md`, faute de compte de test et de parcours cadrés). Décision prise avec l'utilisateur : Playwright, compte Firebase Auth dédié, uniquement des tests unitaires **plus** un socle e2e restreint (pas de suite exhaustive UI, cf. `nesttrip-testing` pour la répartition unitaire/e2e).

## Lancer la suite

- `npm run e2e` (= `playwright test`) — démarre `ng serve` automatiquement (`webServer` dans `playwright.config.ts`), donc pas besoin de lancer le serveur à la main.
- Nécessite un fichier `.env.e2e` (gitignored) avec `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` — copier `.env.e2e.example`. Le compte doit être un compte Firebase Auth **dédié aux tests**, jamais un compte utilisateur réel.
- Pour cibler un seul fichier : `npx playwright test e2e/login.spec.ts`.

## Compte de test et données

Chaque exécution de `create-trip.spec.ts` crée un vrai trip dans Firestore sous le compte de test (titre horodaté `E2E Test Trip <timestamp>` pour les distinguer). **Aucun nettoyage automatique pour l'instant** — les trips s'accumulent sur le compte de test au fil des runs. À traiter quand le parcours 7 (suppression) sera ajouté (voir backlog ci-dessous) : un `afterEach` pourrait supprimer ce que le test vient de créer.

## Accès réseau (bac à sable Claude) : à retester, pas à supposer bloqué

Cette section affirmait que Google Maps/Fonts étaient bloqués (403) dans le bac à sable d'exécution de Claude, limitant les parcours Playwright dépendant du rendu Maps à une simple vérification "le conteneur de carte est monté". **Retesté le 2026-07-29** (voir `nesttrip-verify`) : Maps s'affiche bel et bien (tuiles réelles, marqueurs), l'autocomplete Places répond — un parcours Playwright lancé par Claude peut donc, à cette date, confirmer visuellement le rendu Maps (captures d'écran lues via l'outil de lecture d'image), pas seulement le montage du conteneur.

Le compte npm/Playwright a de toute façon toujours un accès réseau qui fonctionne (téléchargement des binaires navigateur + connexion à Firebase, testés avec succès le 2026-07-28).

L'accès réseau au sens large (Maps compris) peut varier d'une session à l'autre selon le bac à sable — retester avant de conclure quoi que ce soit plutôt que de se fier à cette note indéfiniment ; si un parcours Maps échoue avec des signes de blocage réseau, retomber sur "vérifier que le conteneur est monté, laisser le rendu à l'utilisateur/CI".

## Parcours déjà couverts

1. **`e2e/login.spec.ts`** — connexion email/mot de passe avec le compte de test, attend la redirection vers `/trips` (liste "Mes voyages") ou `/trips/:id` (auto-redirection si un seul trip sur le compte, voir `AccueilTripComponent`).
2. **`e2e/create-trip.spec.ts`** — création d'un trip : titre, ville en texte libre (pas besoin de choisir une suggestion Google Places — le `FormControl` est validé dès la frappe, voir `AutoCompleteComponent.onInput`), plage de dates saisie au clavier (`dd/MM/yyyy - dd/MM/yyyy` sur le champ desktop `#dates`, cf. la fonctionnalité "Saisie clavier des dates" de `ROADMAP.md`). Vérifie la redirection vers `/trips/<uuid>`.

`e2e/fixtures/auth.ts` expose `loginViaUi(page)` (utilisé directement par `login.spec.ts`) et la fixture `authenticatedPage` (utilisée par les parcours qui doivent démarrer déjà connectés, ex. `create-trip.spec.ts`).

## Backlog (parcours à ajouter, dans l'ordre de valeur proposé — à ajuster avec l'utilisateur via `nesttrip-roadmap` avant de les lancer)

3. Créer une activité (pool) : saisie titre → sélection Google Place → apparition sur le jour courant.
4. Éditer le form d'une instance jour (type/horaires/prix/réservation) → attendre l'indicateur de sync (`SaveStatusBarComponent`) avant d'asserter la persistance.
5. Déplacer une activité entre deux jours via le calendrier de dispatch (`dispatchActivity`, `ActivityDayDispatchOverlayComponent`).
6. Créer une réservation (hôtel) → vérifier la bannière contextuelle dans le jour concerné.
7. Suppression (activité, puis trip) — vérifier la règle "suppression réservée au créateur". Bon moment pour ajouter le nettoyage des trips créés par les specs 2 et 6.

Ajouter un parcours = suivre le même schéma que 1-2 : locators sur attributs stables (`id`, `formcontrolname`, texte de bouton visible) plutôt que sur des classes CSS, et privilégier une interaction robuste (texte libre, saisie clavier) à une interaction fragile (clic sur une cellule de calendrier dynamique, résultat d'autocomplete réseau) quand le composant le permet.
