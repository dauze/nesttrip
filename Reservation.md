# Feature : Réservations transverses (hôtels, vols, locations de voiture)

## Contexte

NestTrip gère aujourd'hui des `Activity` imbriquées dans chaque `Day` (`days.{timestamp}.activities`). On ajoute un nouveau concept, **`Reservation`**, pour tout élément qui n'appartient pas à un seul jour mais s'étend sur une plage (hôtel, vol, location de voiture, autre item transverse).

**Principe UX retenu (hybride) :**
- Sous-menu dédié **"Réservations"** dans l'onglet général (à côté de `Infos`) → source de vérité, CRUD complet
- **Bannière contextuelle read-only** injectée en haut du contenu scrollable de chaque day panel concerné (check-in/check-out hôtel, vol, etc.) → tap renvoie vers le sous-menu pour éditer

**Consignes générales pour Claude Code (rappel du fonctionnement du repo) :**
- Explorer le code existant avant de proposer des changements (`TripDaySwiperComponent`, `InfosComponent`, `ActivityPersistenceService`, `GooglePlaceService`, `FileService`)
- Respecter la stack : Angular 21.2 standalone + signals + `inject()`, Firebase JS SDK v12 vanilla, PrimeNG 21.1 + PrimeFlex + Aura, RxJS 7.8
- Respecter la séparation stricte : `infra` (accès Firebase) → `TripStore` (state signals normalisé) → `TripFacade` (seul point d'entrée pour les composants)
- Jamais de mutation de state en place — toujours de nouveaux objets/maps
- Dot-notation pour les updates Firestore
- Fichiers complets copiables plutôt que des diffs partiels, sauf demande explicite
- Chaque phase ci-dessous doit être testable indépendamment avant de passer à la suivante

---

## Modèle de données

```typescript
export type ReservationType = 'hotel' | 'flight' | 'carRental' | 'other';

export interface ReservationBase {
  id: string;
  type: ReservationType;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  referenceNumber?: string;
  notes?: string;
  files: FileFirebase[];
  links: { label: string; url: string }[];
  price?: PriceFirebase;
}

export interface HotelReservation extends ReservationBase {
  type: 'hotel';
  place: PlaceSummary;
}

export interface FlightReservation extends ReservationBase {
  type: 'flight';
  airline: string;
  flightNumber: string;
  departureAirport: PlaceSummary;
  arrivalAirport: PlaceSummary;
  status?: FlightStatus;
  statusFetchedAt?: Date;
}

export interface CarRentalReservation extends ReservationBase {
  type: 'carRental';
  company: string;
  pickupPlace: PlaceSummary;
  dropoffPlace: PlaceSummary;
}

export interface OtherReservation extends ReservationBase {
  type: 'other';
  place?: PlaceSummary;
}

export type Reservation =
  | HotelReservation
  | FlightReservation
  | CarRentalReservation
  | OtherReservation;

export interface FlightStatus {
  state: 'scheduled' | 'onTime' | 'delayed' | 'cancelled' | 'landed';
  delayMinutes?: number;
  actualDepartureTime?: Date;
  actualArrivalTime?: Date;
}
```

**Firestore** : nouveau champ sur `TripFirebase` :
```typescript
reservations: Record<string, ReservationFirebase>;
```
Indépendant du map `days`. Dot-notation pour les updates (`reservations.{id}`), même pattern que `days.{timestamp}`.

---

## Phase 1 — Couche data (infra + store)

**Objectif** : CRUD complet en base, sans UI. Testable via un script ou les devtools Firestore.

**Fichiers à créer :**
- `src/app/core/models/reservation.dto.ts` — types ci-dessus (côté modèle app)
- `src/app/core/infra/firebase/models/reservation.dto.ts` — `ReservationFirebase` (dates en string/number comme pour `ActivityFirebase`)
- `src/app/core/infra/firebase/mappers/reservation.mapper.ts` — `reservationFromFb` / `reservationToFb` (même pattern que `activity.mapper.ts`)
- `src/app/core/infra/firebase/services/persistence/reservation-persistence.service.ts` — `extends DebounceWriter<string, ReservationUpdate>`, méthodes `queueUpdate`, `create`, `remove` (create/remove en écriture directe non debounced, seul l'edit passe par le debounce)

**Fichiers à modifier :**
- `src/app/core/infra/firebase/models/trip.dto.ts` — ajouter `reservations: Record<string, ReservationFirebase>` sur `TripFirebase`
- `src/app/core/infra/firebase/mappers/trip.mapper.ts` — mapper `reservations` dans `tripFromFb`/`tripToFb`
- `TripStore` — ajouter une map normalisée `reservations: Map<string, Reservation>` + actions (`addReservation`, `updateReservation`, `removeReservation`), toujours produire de nouvelles Map (jamais de mutation in place)
- `TripFacade` — exposer `reservations$`/`reservations()` et les actions CRUD, sélecteurs mémoïsés :
  - `reservationsForDay(dayId: Date)` → filtre les réservations dont `[startDateTime, endDateTime]` touche ce jour
  - `allReservationsSorted()` → triées par `startDateTime`, pour la liste du sous-menu

**Validation de la phase** : créer/modifier/supprimer une réservation depuis la console ou un composant de test minimal, vérifier la synchro Firestore ↔ store.

---

## Phase 2 — Sous-menu "Réservations" (liste + CRUD)

**Objectif** : UI complète pour créer/éditer/supprimer des réservations, indépendamment des bannières.

**Composants à créer :**
- `reservations-list.component.ts` — liste chronologique, icône par type (🏨 ✈️ 🚗 📌), tap → ouvre le formulaire en édition
- `reservation-form.component.ts` — conteneur du formulaire, gère `commonForm` (champs communs) + `detailsForm` reconstruit selon le type sélectionné
- `reservation-details-form.factory.ts` — factory `buildDetailsForm(type: ReservationType): FormGroup`
- Composants "dumb" par type, chacun ne connaît que son bout de formulaire, reçoit son `FormGroup` en `input()` :
  - `hotel-fields.component.ts` — `p-autocomplete` branché sur `GooglePlaceService` pour `place`
  - `flight-fields.component.ts` — `airline`, `flightNumber`, `departureAirport`/`arrivalAirport` (2x autocomplete Places), `departureDateTime`/`arrivalDateTime`
  - `car-rental-fields.component.ts` — `company`, `pickupPlace`/`dropoffPlace` (2x autocomplete Places)
  - `generic-fields.component.ts` — `place` optionnel

**Champs communs (`commonForm`)** : `title` (pré-rempli auto selon le type, éditable), `startDateTime`/`endDateTime` (`p-datepicker`), `referenceNumber`, `notes`, `files` (réutiliser le composant d'upload existant sur `Activity`), `links` (FormArray dynamique), `price` (`p-inputnumber` + devise)

**Point d'attention pour Claude Code** : au changement de `type`, seul `detailsForm` doit être détruit/recréé — ne pas perdre les valeurs déjà saisies dans `commonForm`. À la sauvegarde, merger `commonForm.value` + `detailsForm.value` selon le discriminant `type` avant d'appeler `ReservationPersistenceService`.

**Intégration navigation** : ajouter l'entrée "Réservations" dans le sous-menu de l'onglet général, à côté de `Infos`.

**Validation de la phase** : créer un hôtel, un vol, une location, une réservation "autre" depuis l'UI ; vérifier persistance et ré-ouverture en édition.

---

## Phase 3 — Bannière contextuelle dans les jours

**Objectif** : afficher les réservations concernées en haut de chaque day panel, en lecture seule.

**Composants à créer :**
- `day-reservation-banner.component.ts` — `input()` reçoit les réservations du jour (via `reservationsForDay(dayId)`), affiche une carte compacte par réservation (icône type + horaire + titre), tap → navigue vers le sous-menu Réservations en mode édition sur cet item

**Logique d'affichage par type :**
- Hôtel : bannière "Check-in" sur le jour de `startDateTime`, bannière "Check-out" sur le jour de `endDateTime` (si l'hôtel couvre plusieurs jours, pas de bannière répétée chaque nuit — seulement entrée/sortie, pour ne pas polluer les jours intermédiaires ; à confirmer avec toi si tu préfères un rappel chaque jour intermédiaire)
- Vol : bannière sur le jour du `departureDateTime` (et `arrivalDateTime` si jour différent, ex. vol de nuit)
- Location de voiture : bannière sur le jour de pickup et sur le jour de dropoff

**Intégration dans `TripDaySwiperComponent`** :
- Le composant s'insère en haut du **contenu scrollable propre à chaque slide** (le container `overflow-y: auto; height: 100dvh` par jour défini dans l'archi en cours), jamais dans le toolbar/header qui reste une instance stable unique
- Compatible avec la virtualisation des slides prévue : le composant ne doit re-fetcher/recalculer que quand son day slide est monté

**Validation de la phase** : vérifier l'apparition/disparition correcte des bannières sur les bons jours pour chaque type, y compris cas limites (hôtel qui commence/finit un jour sans activité, vol de nuit à cheval sur deux jours).

---

## Phase 4 — Statut vol (AeroDataBox)

**Objectif** : afficher un badge "à l'heure / retardé / annulé" sur les réservations de type `flight`, avec refresh intelligent.

**Backend (Firebase Function proxy)** :
- Nouvelle fonction `getFlightStatus(flightNumber: string, date: string)` — même pattern que le proxy Places existant, clé API AeroDataBox côté serveur uniquement
- Endpoint AeroDataBox : FIDS par numéro de vol + date (tier bas, peu coûteux)
- Retourne un `FlightStatus` mappé, écrit par le client appelant dans `reservations.{id}.status` + `statusFetchedAt` (dot-notation, cache partagé Firestore entre tous les membres du trip)

**Logique de refresh côté client** — service `FlightStatusRefreshService` :

```typescript
type RefreshPhase = 'manual' | 'auto-daily' | 'auto-live' | 'frozen';

function getRefreshPhase(flight: FlightReservation, now: Date): RefreshPhase {
  const hoursToDeparture = diffHours(flight.startDateTime, now);
  const hoursSinceArrival = diffHours(now, flight.endDateTime);

  if (hoursSinceArrival > 2) return 'frozen';
  if (hoursToDeparture <= 0) return 'auto-live';
  if (hoursToDeparture <= 24) return 'auto-daily';
  return 'manual';
}

const REFRESH_INTERVAL_MS: Record<RefreshPhase, number | null> = {
  manual: null,
  'auto-daily': 30 * 60_000,
  'auto-live': 5 * 60_000,
  frozen: null,
};
```

- Le polling ne tourne **que si le composant affichant le vol est réellement visible** (slide actif ou item ouvert dans le sous-menu) — utiliser `effect()` avec `onCleanup` pour démarrer/arrêter le `setInterval`, jamais de polling global en arrière-plan
- Un seul client déclenche le fetch réel à un instant donné (comparaison `staleness = now - statusFetchedAt` vs `REFRESH_INTERVAL_MS[phase]`) ; les autres membres reçoivent la mise à jour gratuitement via `onSnapshot`
- Bouton refresh manuel toujours visible, avec cooldown de 60s (désactivé + tooltip pendant le cooldown)

**UI** : badge coloré sur la bannière et dans le sous-menu (vert = à l'heure, orange = retardé avec délai affiché, rouge = annulé, gris = pas encore de données)

**Disclaimer UX** : préciser dans l'interface (ex. petit texte sous le badge) que le statut est informatif et peut différer de la source officielle de la compagnie.

**Validation de la phase** : tester sur 2-3 vols réels (dont un hors Europe/US si possible, pour vérifier la couverture AeroDataBox), vérifier que le polling s'arrête bien quand on quitte le slide/composant, vérifier le cache partagé (deux sessions du même trip ne doublent pas les appels API).

---

## Ordre d'implémentation

1. Phase 1 (data layer) — bloquant pour tout le reste
2. Phase 2 (CRUD UI) — peut être livré et utilisé seul (sans bannières ni statut vol)
3. Phase 3 (bannières) — dépend de la Phase 1 uniquement, peut être fait en parallèle de la Phase 2 si besoin
4. Phase 4 (statut vol) — dépend de la Phase 2 (avoir des vols saisis pour tester)
