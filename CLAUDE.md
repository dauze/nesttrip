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

- `_trips: Record<tripId, Trip>`, `_days: Record<dayKey, Day>`, `_activities: Record<activityId, Activity>` (pool plat de **toutes** les activités connues, tous trips confondus)
- `_tripDays: Record<tripId, dayKey[]>`, `_dayActivities: Record<dayKey, activityId[]>`, `_tripActivities: Record<tripId, activityId[]>` (toutes les activités d'un trip, dispatchées ou non)
- `_notesItems` / `_tripNotesItems`, `_tripMembers: Record<tripId, Record<email, TripMember>>`
- `dayKey` = `day.id.toISOString()` partout côté store (à ne pas confondre avec la clé Firestore `getTime()`, voir plus haut)

**Pourquoi normaliser** : une activité peut être affichée à la fois dans un jour et dans une vue générale. La stocker une seule fois (`_activities`) et la référencer ailleurs par id garantit qu'une édition se répercute partout instantanément, sans dupliquer l'état à synchroniser.

**Sélecteur `activeTrip`** : `computed()` qui recompose `Trip` à partir de `_trips` + `_tripDays` + `_days`, mais renvoie volontairement `activities: []` — le pool d'activités n'est **pas** lu ici. Le lire aurait rendu `activeTrip` (et tout ce qui en dépend, y compris le skeleton de chargement) réactif à chaque édition d'activité. Les activités se consomment via des sélecteurs dédiés et mémoïsés : `getActivities(dayId)`, `getActivity(id)`, `getAllActivities(tripId)`, `getActivityDayIds(tripId)` — chacun met en cache son `Signal` calculé dans une `Map` interne, créé à la demande.

**Flux optimiste d'une commande** (ex. `updateActivity`, `createActivity`, `dispatchActivity`, `addDay`...) — le même schéma partout dans `TripStore` :
1. Mise à jour **immédiate** des signals locaux via `.update((map) => ({ ...map, ... }))` — jamais de mutation en place, toujours un nouvel objet/map.
2. Déclenchement de la persistance : `queueUpdate(...)` sur un service `DebounceWriter` pour les écritures fréquentes, ou appel direct promis pour les opérations ponctuelles.
3. Rien ne recharge la page : le composant lit un `computed`/`signal`, sa référence change à l'étape 1, Angular rerend juste ce qui dépend de cette entité.

**Anti-flicker pendant le debounce (`_pendingActivityIds`)** — le point clé pour ne pas "revenir en arrière" :
- Chaque commande qui touche une activité (`createActivity`, `createGeneralActivity`, `updateActivity`) appelle `markActivityPending(activity.id)`, qui ajoute l'id à `_pendingActivityIds`.
- Dans `TripFacade.mergeFromRemote` (appelée à chaque nouveau snapshot Firestore une fois le trip déjà hydraté), toute activité dont l'id est dans `_pendingActivityIds` est **ignorée** — le snapshot distant ne l'écrase pas, pour ne pas faire "reculer" visuellement une édition en cours de debounce.
- Le nettoyage de `_pendingActivityIds` n'est **pas** fait id par id à la confirmation Firestore : un `effect()` dans le constructeur de `TripStore` observe `activityPersistenceService.syncing()` et vide **tout le set** (`_pendingActivityIds.set(new Set())`) dès que ce signal repasse à `false`, c'est-à-dire dès que le writer débouncé n'a plus aucune écriture d'activité en attente. Implication : tant qu'une activité est en cours de debounce, **toutes** les activités marquées pending restent protégées jusqu'à ce que le lot entier soit flush, pas seulement celle qui vient d'être modifiée.

**Règle à respecter dans tout nouveau code touchant le store** : ne jamais faire `map[key].push(...)`/`obj.prop = x` sur une valeur lue depuis un signal. Toujours `signal.update((current) => ({ ...current, [key]: nouvelleValeur }))` (ou reconstruire un nouveau tableau). C'est la seule façon dont Angular détecte le changement et rerend sans recharger la page.

### Points d'attention

- `AuthService.getCurrentUser()` est une lecture **synchrone** de `firebaseAuth.currentUser` : ça suppose que le route guard a déjà résolu l'utilisateur. Ne pas ajouter d'`await` ou de logique async autour sans vérifier l'impact sur les guards.
- Certains commentaires dans le code sont en français — garder cette langue si tu édites un commentaire existant dans un fichier qui est déjà commenté en français.
- Les appels vers Google Places passent par le backend maison (`environment.apiUrl/etablissements/...`), pas directement vers l'API Google côté client.
- Ne jamais muter `Trip`/`Day`/`Activity` en place — voir la section TripFacade/TripStore ci-dessus.
- Ne pas lire `_activities` (le pool complet) dans un `computed` largement utilisé comme `activeTrip` : ça casserait l'isolation de perf voulue. Passer par les sélecteurs dédiés (`getActivities`, `getAllActivities`...).
- `dayKey` en mémoire (`toISOString()`) ≠ clé du document Firestore (`getTime()`) : ne pas les confondre lors d'un debug ou d'un nouveau développement.

## Ce que je ne veux pas que tu fasses

- Ne pas introduire de nouveau pattern d'accès aux données en dehors du couple repository/data source/mapper existant sans demander.
- Ne pas committer/modifier `environnements/environnement*.ts` avec des clés en clair sans prévenir.
- Ne pas court-circuiter `_pendingActivityIds` ni son nettoyage global via l'`effect()` sur `syncing()` : c'est ce qui empêche l'UI de "revenir en arrière" pendant une écriture debouncée en cours.