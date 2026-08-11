import { Interest, TripAiPreferences } from './trip-ai-preferences.model';

/**
 * État du job de génération IA d'un trip (Lot 2, mode `activities_only` —
 * voir src/specs/process-creation-trip-ia.md §4). Vit dans sa PROPRE
 * collection Firestore (`tripGenerations/{tripId}`), volontairement séparée
 * du document `trips/{tripId}` : le statut de génération est un état
 * transitoire de PIPELINE (recherche → sélection → aperçu), pas une
 * propriété durable du domaine `Trip` — l'isoler évite de complexifier
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
}

export interface TripGeneration {
  tripId: string;
  status: TripGenerationStatus;
  preferences: TripAiPreferences;
  destination: { ville: string; placeId: string; latitude: number; longitude: number };
  /** Pool complet récupéré côté serveur (§4.1) — sert de réservoir pour "Remplacer" (§2.6), jamais ré-appelé pour ça. */
  candidates: GeneratedActivityCandidate[];
  /** Sous-ensemble actuellement proposé à l'utilisateur (§2.5) — modifié localement (exclusion) et via "Remplacer" avant validation. */
  preview: GeneratedActivityCandidate[];
  /** Renseigné seulement si `status === 'failed'` (§4.5). */
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
