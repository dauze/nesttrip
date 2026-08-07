import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { Logistic } from '@core/models/logistic.dto';
import { Expense } from '@core/models/expense.dto';
import { Notes } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';

export type TripRole = 'owner' | 'editor';
export interface Trip {
  id: string;
  ville: string;
  title: string;
  ownerId: string;
  members: Record<string, TripMember>;
  days: Day[];
  /** Pool léger de toutes les activités du trip (identité + fichiers, pas de form). */
  activities: PoolActivity[];
  /** Instances réelles (form) rattachées aux jours, référencées par Day.activityIds. */
  dayActivityInstances: DayActivityInstance[];
  /** Réservations transverses (hôtel/vol/location/autre), indépendantes des jours. */
  logistics: Logistic[];
  /** Dépenses libres (non rattachées à une activité/logement/transport, ex. un smoothie), indépendantes des jours — voir src/specs/devise.md 3.4. */
  expenses: Expense[];
  notes: Notes;
  placeId?: string;
  /** Paliers de distance (vol d'oiseau, km) + mode associé pour la sélection auto du mode de trajet affiché entre activités — voir `selectTravelMode`. */
  travelTiers?: TravelTiers;
  /** Override manuel du mode de trajet pour une paire de lieux donnée (clé = `buildPlacePairKey`) — écrase la sélection auto (`selectTravelMode`) tant qu'il existe pour cette paire. Absence de clé = automatique. */
  travelModeOverrides?: Record<string, 'walk' | 'bike' | 'car'>;
}

/**
 * 3 paliers de distance, chacun avec son mode de trajet CHOISI PAR
 * L'UTILISATEUR (pas figé à marche/vélo/voiture dans cet ordre) — palier 1
 * jusqu'à `tier1MaxKm`, palier 2 de `tier1MaxKm` à `tier2MaxKm`, palier 3
 * ("sinon") au-delà, sans borne. Voir `selectTravelMode`.
 */
export interface TravelTiers {
  tier1Mode: 'walk' | 'bike' | 'car';
  tier1MaxKm: number;
  tier2Mode: 'walk' | 'bike' | 'car';
  tier2MaxKm: number;
  tier3Mode: 'walk' | 'bike' | 'car';
}

/** Valeurs par défaut appliquées tant que le trip n'a pas de `travelTiers` stocké (voir `TripStore.getTripTravelTiers`) — jamais écrites en Firestore tant que l'utilisateur n'édite pas explicitement. */
export const DEFAULT_TRAVEL_TIERS: TravelTiers = { tier1Mode: 'walk', tier1MaxKm: 1.5, tier2Mode: 'bike', tier2MaxKm: 8, tier3Mode: 'car' };

/**
 * Projection légère utilisée par le dashboard (`AccueilTripComponent`, voir
 * `TripStore._tripsResult`) : pas de `days`/`activities`/... (trop coûteux à
 * garder pour TOUS les trips d'un utilisateur en mémoire, voir CLAUDE.md
 * "état normalisé") — seulement `earliestDay`/`latestDay` (bornes de
 * l'intervalle de jours, voir ROADMAP.md "UX / Interactions", détection du
 * "voyage actif" à la connexion), calculées côté data source directement
 * depuis les clés du map Firestore `days`, sans mapper complet.
 */
export interface TripSummary extends Pick<Trip, 'id' | 'title' | 'ownerId'> {
  earliestDay?: Date;
  latestDay?: Date;
}

export interface Day {
  id: Date;
  /** Référence des DayActivityInstance.id, pas des activités de pool. */
  activityIds: string[];
}


export interface TripMember {
  role: TripRole;
  email: string;
  displayName?: string;
}