# Nest Trip — Instructions projet

App Angular de planification de voyages (jours, activités, réservations) avec backend Firebase (Firestore/Auth/Storage) et un petit backend maison pour les données Google Places.

Voir `ROADMAP.md` à la racine pour la liste des fonctionnalités déjà en place (à ne pas casser) et ce qui reste à faire.

## Stack

- Angular 21 (standalone, signals, `inject()`) — pas de NgModules, pas d'injection par constructeur
- Firebase JS SDK v12 (`firestore`, `auth`, `storage`)
- RxJS 7.8
- PrimeNG / PrimeFlex / PrimeIcons pour l'UI
- Swiper (élément web) pour les carousels de jours
- Tests : Vitest (`ng test`) — pas Jasmine/Karma
- Lint : ESLint (angular-eslint) + Prettier

## Commandes

- `ng serve` — dev server
- `ng build` — build prod
- `ng test` — tests (Vitest)
- `ng lint` — lint
- `npx tsx scripts/seed-firestore.ts` (ou `npm run script`) — seed Firestore

Toujours lancer `ng lint` avant de considérer une modification terminée.

## Architecture

```
src/app/core/
  infra/firebase/
    models/          # DTOs Firebase : suffixe `*Firebase` (TripFirebase, ActivityFirebase...)
    mappers/          # fonctions pures xFromFb / xToFb, une par entité
    services/          # data sources (lecture temps réel via onSnapshot)
      persistence/     # écritures (setDoc/updateDoc), souvent via DebounceWriter
    firebase.service.ts # app + db Firestore, singleton
  services/           # services transverses (auth, google maps, fichiers, swiper...)
  models/             # DTOs génériques non liés à Firebase (place.dto.ts...)
src/app/features/     # UI par domaine (trips, trip-detail, ...), contient les *.model.ts (domaine)
```

### Patterns à respecter

- **Repository** : une classe abstraite (`abstract class XRepository`) exposant des `Observable`, implémentée par une classe Firebase concrète injectée via `providers` (voir `TripRepository` / `FirebaseTripRepository`). Les composants dépendent de l'abstraction, jamais directement de Firebase.
- **Mapper** : toute conversion Firebase <-> domaine passe par des fonctions pures `xFromFb(data: XFirebase): X` et `xToFb(data: X): XFirebase` dans `core/infra/firebase/mappers/`. Ne jamais faire ce mapping inline dans un composant ou un service de data source.
- **Lecture temps réel** : les data sources (`*-data-source.ts`) enveloppent `onSnapshot` dans un `new Observable(...)` avec cleanup via le `return () => unsub()`.
- **Écriture debouncée** : les services de `persistence/` qui font des écritures fréquentes (activités, infos) étendent `DebounceWriter<K, T>` : on appelle `queue(key, value)`, jamais `write()` directement. Ça batch et débounce automatiquement (300ms) et expose un signal `syncing`.
- **Écriture simple/ponctuelle** (création, suppression, titre) : `setDoc`/`updateDoc`/`deleteDoc` directs, pas besoin de DebounceWriter.
- **Clés dynamiques Firestore** : les jours sont stockés sous `days.${timestamp}` (clé = `Date.getTime()` en string). Respecter ce format si tu touches à cette partie du schéma.
- **Signals + RxJS interop** : les services avec état dérivé utilisent `toSignal`/`toObservable` (voir `google-place.service.ts` et `LoadingState<T>` dans `place.dto.ts`) plutôt que de mélanger `BehaviorSubject` et signals sans raison.

### TripFacade / TripStore — état normalisé et UI optimiste (important)

`TripStore` (`providedIn: 'root'`) ne stocke pas des `Trip` imbriqués : c'est un **état normalisé** façon store relationnel, chaque type d'entité dans sa propre map signal indexée par id, les relations étant de simples listes d'ids :

- `_trips: Record<tripId, Trip>`, `_days: Record<dayKey, Day>`
- `_poolActivities: Record<poolId, PoolActivity>` (pool plat de **toutes** les activités "légères" connues, tous trips confondus — identité Google + fichiers uniquement, **jamais** le form)
- `_dayActivityInstances: Record<instanceId, DayActivityInstance>` (pool plat de **toutes** les instances connues, tous trips confondus — le form : type/durée/horaires/prix/réservation/notes, référence son activité de pool via `instance.activityId`)
- `_tripDays: Record<tripId, dayKey[]>`, `_dayActivityIds: Record<dayKey, instanceId[]>` (instances référencées par un jour, dans l'ordre), `_tripActivities: Record<tripId, poolId[]>` (toutes les activités de pool d'un trip, placées sur un/plusieurs jours ou aucun)
- `_notesItems` / `_tripNotesItems`, `_tripMembers: Record<tripId, Record<email, TripMember>>`
- `dayKey` = `day.id.toISOString()` partout côté store (à ne pas confondre avec la clé Firestore `getTime()`, voir plus haut)

**Pool "léger" + instances par jour (important)** : une activité de pool (`PoolActivity` : id, title, placeId/address/lat/lng, photoRefs, `files`) peut être placée sur **plusieurs jours simultanément**. Chaque placement crée une `DayActivityInstance` séparée (son propre id, son propre form), référençant la même `PoolActivity` via `activityId`. Éditer le form d'une instance (via `ActivityFormComponent`) n'affecte que cette instance ; éditer l'identité ou les fichiers (titre, lieu Google, upload/suppression de fichier) affecte toujours la `PoolActivity` et se répercute donc sur toutes ses instances, puisque les fichiers ne vivent **que** sur le pool (jamais dupliqués par instance — chemin Storage `trips/{tripId}/{poolActivityId}/...`). L'UI consomme une vue composée `Activity` (mêmes champs qu'avant + `activityId` en FK vers le pool) : `id` vaut l'instanceId en contexte jour, le poolId en contexte pool (auto-référencé par `activityId`). `ActivityCardComponent` bascule entre les deux vues selon la présence de son input `dayId` ; le form (`app-activity-form`) n'est monté qu'en contexte jour.

**Pourquoi normaliser** : une activité peut être affichée à la fois dans un/plusieurs jours et dans une vue générale. Stocker l'identité une seule fois (`_poolActivities`) et la référencer ailleurs par id garantit qu'une édition d'identité/fichier se répercute partout instantanément ; stocker chaque instance séparément (`_dayActivityInstances`) garantit que le form d'un placement n'écrase jamais celui d'un autre.

**Sélecteur `activeTrip`** : `computed()` qui recompose `Trip` à partir de `_trips` + `_tripDays` + `_days`, mais renvoie volontairement `activities: []` et `dayActivityInstances: []` — le pool et les instances ne sont **pas** lus ici. Les lire aurait rendu `activeTrip` (et tout ce qui en dépend, y compris le skeleton de chargement) réactif à chaque édition d'activité. Les activités se consomment via des sélecteurs dédiés et mémoïsés : `getDayActivities(dayId)`, `getDayActivity(instanceId)`, `getPoolActivity(poolId)`, `getPoolActivityView(poolId)`, `getAllPoolActivities(tripId)`, `getActivityDayIds(tripId)` (retourne `Map<poolId, Date[]>` — une activité de pool peut être placée sur zéro, un ou plusieurs jours) — chacun met en cache son `Signal` calculé dans une `Map` interne, créé à la demande.

**Flux optimiste d'une commande** (ex. `updatePoolActivity`, `updateDayActivityInstance`, `createActivity`, `dispatchActivity`, `addDay`...) — le même schéma partout dans `TripStore` :
1. Mise à jour **immédiate** des signals locaux via `.update((map) => ({ ...map, ... }))` — jamais de mutation en place, toujours un nouvel objet/map.
2. Déclenchement de la persistance : `queueUpdate(...)` sur un service `DebounceWriter` pour les écritures fréquentes (`ActivityPersistenceService` pour le pool, `DayActivityInstancePersistenceService` pour les instances), ou appel direct promis pour les opérations ponctuelles.
3. Rien ne recharge la page : le composant lit un `computed`/`signal`, sa référence change à l'étape 1, Angular rerend juste ce qui dépend de cette entité.

**Drag-and-drop inter-jours** (`dispatchActivity(tripId, activityId, origin, targetDayId)`, appelé depuis `ActivityDayDispatchOverlayComponent`) : `origin === 'pool'` (décrochage depuis le pool général) crée une **nouvelle** instance sur le jour cible (`attachPoolActivityToDay`) sans toucher aux autres placements ; `origin === 'day'` (décrochage depuis un jour) **déplace** l'instance existante vers le jour cible (`moveDayActivityInstance`, garde son form). `activityId` porte donc soit un poolId (origin pool) soit un instanceId (origin day) — voir `ActivityCardComponent.buildDraggedInfo`.

**Anti-flicker pendant le debounce (`_pendingActivityIds`)** — le point clé pour ne pas "revenir en arrière" :
- Chaque commande qui touche une activité de pool OU une instance (`createActivity`, `createGeneralActivity`, `attachPoolActivityToDay`, `updatePoolActivity`, `updateDayActivityInstance`...) appelle `markActivityPending(id)`, qui ajoute l'id (poolId ou instanceId, pas de collision possible entre deux UUID) à `_pendingActivityIds`.
- Dans `TripFacade.mergeFromRemote` (appelée à chaque nouveau snapshot Firestore une fois le trip déjà hydraté), toute activité de pool ou instance dont l'id est dans `_pendingActivityIds` est **ignorée** — le snapshot distant ne l'écrase pas, pour ne pas faire "reculer" visuellement une édition en cours de debounce.
- Le nettoyage de `_pendingActivityIds` n'est **pas** fait id par id à la confirmation Firestore : un `effect()` dans le constructeur de `TripStore` observe `activityPersistenceService.syncing()` **ET** `dayActivityInstancePersistenceService.syncing()` et vide **tout le set** (`_pendingActivityIds.set(new Set())`) dès que les DEUX writers débouncés n'ont plus rien en attente. Implication : tant qu'une activité de pool OU une instance est en cours de debounce, **toutes** les activités/instances marquées pending restent protégées jusqu'à ce que les deux lots soient flush, pas seulement celle qui vient d'être modifiée.

**Règle à respecter dans tout nouveau code touchant le store** : ne jamais faire `map[key].push(...)`/`obj.prop = x` sur une valeur lue depuis un signal. Toujours `signal.update((current) => ({ ...current, [key]: nouvelleValeur }))` (ou reconstruire un nouveau tableau). C'est la seule façon dont Angular détecte le changement et rerend sans recharger la page.

### Points d'attention

- `AuthService.getCurrentUser()` est une lecture **synchrone** de `firebaseAuth.currentUser` : ça suppose que le route guard a déjà résolu l'utilisateur. Ne pas ajouter d'`await` ou de logique async autour sans vérifier l'impact sur les guards.
- Certains commentaires dans le code sont en français — garder cette langue si tu édites un commentaire existant dans un fichier qui est déjà commenté en français.
- Les appels vers Google Places passent par le backend maison (`environment.apiUrl/etablissements/...`), pas directement vers l'API Google côté client.
- Ne jamais muter `Trip`/`Day`/`Activity`/`PoolActivity`/`DayActivityInstance` en place — voir la section TripFacade/TripStore ci-dessus.
- Ne pas lire `_poolActivities`/`_dayActivityInstances` (les pools complets) dans un `computed` largement utilisé comme `activeTrip` : ça casserait l'isolation de perf voulue. Passer par les sélecteurs dédiés (`getDayActivities`, `getAllPoolActivities`...).
- `dayKey` en mémoire (`toISOString()`) ≠ clé du document Firestore (`getTime()`) : ne pas les confondre lors d'un debug ou d'un nouveau développement.
- Une activité de pool peut avoir plusieurs `DayActivityInstance` (une par jour où elle est placée) : ne jamais supposer qu'un `poolId` correspond à au plus une instance/un jour.

## Ce que je ne veux pas que tu fasses

- Ne pas introduire de nouveau pattern d'accès aux données en dehors du couple repository/data source/mapper existant sans demander.
- Ne pas committer/modifier `environnements/environnement*.ts` avec des clés en clair sans prévenir.
- Ne pas court-circuiter `_pendingActivityIds` ni son nettoyage global via l'`effect()` sur `syncing()` : c'est ce qui empêche l'UI de "revenir en arrière" pendant une écriture debouncée en cours.