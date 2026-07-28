---
name: nesttrip-verify
description: Gate de vérification obligatoire avant d'annoncer une tâche terminée dans NestTrip — lint, typecheck, tests unitaires, et rappel des limites de vérification visuelle (Google Maps/Fonts bloqués dans le bac à sable). À utiliser systématiquement en fin de tâche de code sur ce repo, avant de dire "c'est fait".
---

# Vérifier avant de dire "terminé" (NestTrip)

Exécuter dans l'ordre, s'arrêter et corriger avant de continuer si une étape échoue :

1. **`ng lint`** — obligatoire (déjà la règle dans `CLAUDE.md`).
2. **`npx tsc --noEmit -p tsconfig.app.json`** — typecheck complet ; attrape des erreurs de type que le lint ne couvre pas (notamment dans les templates avec `strictTemplates`).
3. **`ng test`** (Vitest, unitaire) — toujours, même pour un changement qui semble petit. Si le fichier touché a un `.spec.ts` colocalisé qui existe déjà, vérifier qu'il couvre encore le nouveau comportement (l'étendre si besoin, cf. skill `nesttrip-testing`). Si le fichier touché est un mapper ou une commande/sélecteur pur du `TripStore` et n'a pas encore de test, envisager d'en ajouter un avant de clore (ROI élevé, voir `nesttrip-testing`).
4. **Suite e2e (Playwright)** — seulement si le changement touche un des parcours déjà couverts (voir `nesttrip-e2e`) ou en ajoute un nouveau. Ne pas lancer la suite complète pour un changement trivial sans rapport : `npx playwright test <fichier ciblé>` suffit la plupart du temps.

## Limite connue : vérification visuelle

Dans le bac à sable d'exécution de Claude, les appels réseau vers Google Maps et Google Fonts sont bloqués (proxy renvoie 403 — voir `ROADMAP.md`, note du plan d'exécution). Conséquences :

- `ng serve` / `ng build` ne suffisent **pas** à confirmer visuellement un changement d'UI, de carte, ou de police.
- Un run Playwright déclenché par Claude dans ce même bac à sable peut échouer ou ne pas exercer entièrement les parcours qui dépendent du rendu Maps, pour la même raison — ce n'est pas nécessairement un bug du code testé.
- **Ne jamais écrire "vérifié visuellement" ou "testé dans le navigateur" sans confirmation réelle de l'utilisateur.** Si le changement est visuel/UX, dire explicitement "lint/typecheck/tests passent, à confirmer visuellement côté utilisateur" plutôt que de prétendre à une vérification qui n'a pas eu lieu.
- Une exécution complète et fiable (Maps compris) se fait soit par l'utilisateur en local, soit en CI avec un accès réseau réel.
