---
name: nesttrip-testing
description: Conventions de tests unitaires (Vitest) pour NestTrip — quoi tester en priorité (mappers, TripStore) et quoi éviter pour l'instant (composants PrimeNG). À utiliser quand on écrit ou étend un fichier *.spec.ts dans ce repo, ou quand nesttrip-verify demande d'ajouter de la couverture.
---

# Tests unitaires (NestTrip)

Le projet est parti de zéro (aucun `*.spec.ts` avant juillet 2026) : pas de convention historique à respecter au-delà des défauts Angular/Vitest. Outillage déjà en place, ne rien réinstaller : `ng test` / `npm test` via `@angular/build:unit-test` (Vitest sous le capot), globals activés (`describe`/`it`/`expect`/`vi` sans import, voir `tsconfig.spec.json`).

**Portée : tests unitaires uniquement.** Le périmètre e2e est couvert par la skill `nesttrip-e2e` (Playwright) — ne pas mélanger les deux approches dans un même fichier.

## Priorité de couverture (ROI décroissant)

1. **Mappers** (`core/infra/firebase/mappers/*.mapper.ts`) — fonctions pures `xFromFb`/`xToFb`, aucune DI, aucun mock nécessaire. Toujours les couvrir en premier quand on les touche. Voir `activity.mapper.spec.ts` comme gabarit.
2. **`TripStore`** (`features/trips/trip-store.service.ts`) — commandes optimistes + protection anti-flicker `_pendingActivityIds`/`_pendingReservationIds`. Le store lui-même n'a pas de dépendance Firebase directe : instancier via `TestBed` en fournissant des **fakes** pour les 8 services injectés (`ActivityPersistenceService`, `DayActivityInstancePersistenceService`, `DayActivitiesPersistenceService`, `ReservationPersistenceService`, `NotesPersistenceService`, `TripPersistenceService`, `DayPersistenceService`, `CollaborationService`) — jamais les vraies classes (elles injectent `FirebaseService`, donc un vrai app Firebase). Pour les writers débouncés, un fake minimal suffit : `{ syncing: signal(false), hasError: signal(false), queueUpdate: vi.fn() }`. Pour observer un `effect()` du store après avoir changé un signal (ex. `syncing`), appeler `TestBed.tick()` (l'ancien `TestBed.flushEffects()` est déprécié). Voir `trip-store.service.spec.ts` comme gabarit.
3. Autre logique pure/computed, seulement une fois 1 et 2 réellement couverts sur le code touché.

**Éviter pour l'instant** : les specs de composants avec rendu PrimeNG (coût de setup élevé — TestBed + module PrimeNG + thème —, signal faible). Si un composant a une vraie logique non triviale, extraire cette logique dans un service/fonction pure testable plutôt que de tester le rendu du composant. Revisiter cette décision isolément si l'utilisateur le demande.

## Convention de fichiers

`*.spec.ts` colocalisé avec le fichier source (défaut Angular) — pas de dossier `__tests__` séparé.
