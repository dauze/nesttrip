import { Interest, TripAiPreferences } from './trip-ai-preferences.model';

/**
 * État du job de génération IA d'un trip (Lots 2/3 — voir
 * src/specs/process-creation-trip-ia.md §4). Vit dans sa PROPRE collection
 * Firestore (`tripGenerations/{tripId}`), volontairement séparée du document
 * `trips/{tripId}` : le statut de génération est un état transitoire de
 * PIPELINE (recherche → sélection → aperçu), pas une propriété durable du
 * domaine `Trip` — l'isoler évite de complexifier
 * `TripFacade.mergeFromRemote`/`TripStore` (déjà très sensibles, voir leur
 * doc) avec un concept qui n'a plus aucune utilité une fois l'aperçu validé.
 */
export type TripGenerationStatus = 'generating' | 'ready_for_preview' | 'failed';

/**
 * Candidat brut issu de la recherche Google Places élargie (§4.1), avant/après
 * sélection par le LLM (§4.2). `excluded` est piloté par l'utilisateur sur
 * l'écran d'aperçu (case à décocher) — jamais réécrit par le serveur une fois
 * `ready_for_preview`.
 */
export interface GeneratedActivityCandidate {
  /** = `placeId` : identifiant stable du candidat au sein de ce job (garde-fou anti-hallucination, voir §4.2). */
  candidateId: string;
  placeId: string;
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs: string[];
  rating?: number;
  /** Centre d'intérêt qui a produit ce candidat (voir §4.1, "pool large par centre d'intérêt"). */
  interest: Interest;
  /** Courte justification affichable (§4.2, ex. "Choisi pour ton intérêt musées"). */
  reason: string;
  excluded: boolean;
  /** Index (0-based) dans `TripGeneration.tripDayDates` — assigné en mode `activities_day`/`full_plan` uniquement (§4.2 : "day (null en mode activities_only)"). */
  day?: number;
  /** Estimation LLM (ou défaut fixe côté stub) — minutes. Utilisée à la validation pour remplir `DayActivityInstance.duration` et dériver `startTime`/`endTime` par curseur séquentiel (voir PreviewComponent.validate) — aucun chemin de génération ne fournit d'horaire précis (voir functions/src/trip-generation/plan-trip-llm.ts pour la raison : un champ horaire libre s'est avéré faire dérailler la sortie structurée du LLM). */
  estimatedDurationMinutes?: number;
  /** Estimation LLM (ou défaut fixe côté stub) — prix moyen par personne, euros. */
  estimatedPriceEur?: number;
}

/** Même anatomie qu'un candidat d'activité (Google Places, `lodging`), rattaché à une ville plutôt qu'à un centre d'intérêt — un seul logement par ville en v1 (§6 : "juste de la donnée descriptive... pas de réservation"). */
export interface GeneratedLodgingCandidate {
  candidateId: string;
  placeId: string;
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs: string[];
  rating?: number;
  city: string;
  reason: string;
  excluded: boolean;
}

/**
 * Estimation générique entre deux villes consécutives (mode `full_plan`
 * multi-villes) — pas d'API de trajet inter-villes branchée en v1 (§6,
 * fallback explicitement prévu par la spec) : distance à vol d'oiseau +
 * libellé indicatif, jamais un vrai horaire. Aucun "Remplacer" possible
 * (rien à repiocher, c'est un calcul déterministe, pas une recherche).
 */
export interface GeneratedTransportSegment {
  id: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  estimatedLabel: string;
}

export interface TripGeneration {
  tripId: string;
  status: TripGenerationStatus;
  preferences: TripAiPreferences;
  destination: { ville: string; placeId: string; latitude: number; longitude: number };
  /** Dates des jours du trip (epoch ms, ordre chronologique) — permet de répartir les activités par jour (`activities_day`/`full_plan`) et de recréer les vraies `DayActivityInstance` sur le bon jour à la validation. */
  tripDayDates: number[];
  /** Pool complet d'activités récupéré côté serveur (§4.1) — sert de réservoir pour "Remplacer" (§2.6), jamais ré-appelé pour ça. */
  candidates: GeneratedActivityCandidate[];
  /** Sous-ensemble d'activités actuellement proposé à l'utilisateur (§2.5) — modifié localement (exclusion) et via "Remplacer" avant validation. */
  preview: GeneratedActivityCandidate[];
  /** Mode `full_plan` uniquement — voir `GeneratedLodgingCandidate`. */
  lodgingCandidates: GeneratedLodgingCandidate[];
  lodgingPreview: GeneratedLodgingCandidate[];
  /** Mode `full_plan` multi-villes uniquement — voir `GeneratedTransportSegment`. */
  transportSegments: GeneratedTransportSegment[];
  /** Renseigné seulement si `status === 'failed'` (§4.5). */
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
