---
name: nesttrip-verify
description: Gate de vérification obligatoire avant d'annoncer une tâche terminée dans NestTrip — lint, typecheck, tests unitaires, et note sur la vérification visuelle réelle (Google Maps/Fonts, accès réseau à retester à chaque session). À utiliser systématiquement en fin de tâche de code sur ce repo, avant de dire "c'est fait".
---

# Vérifier avant de dire "terminé" (NestTrip)

Exécuter dans l'ordre, s'arrêter et corriger avant de continuer si une étape échoue :

1. **`ng lint`** — obligatoire (déjà la règle dans `CLAUDE.md`).
2. **`npx tsc --noEmit -p tsconfig.app.json`** — typecheck complet ; attrape des erreurs de type que le lint ne couvre pas (notamment dans les templates avec `strictTemplates`).
3. **`ng test`** (Vitest, unitaire) — toujours, même pour un changement qui semble petit. Si le fichier touché a un `.spec.ts` colocalisé qui existe déjà, vérifier qu'il couvre encore le nouveau comportement (l'étendre si besoin, cf. skill `nesttrip-testing`). Si le fichier touché est un mapper ou une commande/sélecteur pur du `TripStore` et n'a pas encore de test, envisager d'en ajouter un avant de clore (ROI élevé, voir `nesttrip-testing`).
4. **Suite e2e (Playwright)** — seulement si le changement touche un des parcours déjà couverts (voir `nesttrip-e2e`) ou en ajoute un nouveau. Ne pas lancer la suite complète pour un changement trivial sans rapport : `npx playwright test <fichier ciblé>` suffit la plupart du temps.

## Vérification visuelle : accès réseau à retester, pas à supposer bloqué

Cette section a longtemps affirmé que Google Maps/Fonts étaient bloqués (403) dans le bac à sable d'exécution de Claude, rendant toute vérification visuelle impossible. **Ce n'était déjà plus vrai le 2026-07-29** : testé à cette date avec un run Playwright réel (`npx playwright test` contre `ng serve` local) sur le drawer notes/prix — Google Maps s'affiche (tuiles réelles, marqueurs), l'autocomplete Places du backend maison répond, les captures d'écran sont exploitables pour juger un rendu UI.

Conséquences pratiques :

- **Avant de conclure "bloqué"**, tenter une vérification réelle : `ng serve` + un script Playwright ponctuel (login via `e2e/fixtures/auth.ts`, créer/ouvrir un trip, interagir avec l'UI concernée, `page.screenshot()`), lu ensuite via l'outil de lecture d'image. Un script de vérification ponctuel n'a pas besoin d'être committé — le supprimer une fois la vérification faite si ce n'est pas un parcours à garder dans la suite versionnée (voir `nesttrip-e2e`).
- **L'accès réseau peut varier d'une session à l'autre** (proxy/sandbox différents) — ne pas supposer que c'est acquis pour toujours sur la seule foi de cette note. Si un run échoue avec des indices de blocage réseau (403, timeouts sur des domaines Google), retomber sur l'ancien comportement : dire explicitement "lint/typecheck/tests passent, à confirmer visuellement côté utilisateur" plutôt que de prétendre à une vérification qui n'a pas eu lieu.
- **Ne jamais écrire "vérifié visuellement" sans l'avoir réellement fait** (script Playwright + capture regardée, ou confirmation de l'utilisateur) — la nouveauté ici est que "réellement le faire" est souvent possible, pas que l'affirmation sans preuve devienne acceptable.
