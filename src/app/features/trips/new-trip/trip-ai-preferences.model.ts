import { SelectButtonOption } from '@app/shared/components/select-button/select-button.component';

/**
 * Contrat local des préférences IA (Lot 1, front-only — voir
 * src/specs/process-creation-trip-ia.md §3). Rien n'est encore envoyé au
 * backend : cet objet vit uniquement dans l'état du formulaire "Nouveau
 * voyage" tant que le Lot 2 (pipeline de génération) n'existe pas.
 */
export type PlanningMode = 'manual' | 'ai';

export type AssistanceLevel = 'activities_only' | 'activities_day' | 'full_plan';

export type TravelerType = 'solo' | 'couple' | 'family' | 'friends';

export type Pace = 'relaxed' | 'balanced' | 'intense';

export type Interest = 'museums' | 'nature' | 'sport' | 'food' | 'nightlife' | 'shopping' | 'relaxation' | 'offbeat';

export interface TripAiPreferences {
  assistanceLevel: AssistanceLevel;
  travelerType: TravelerType | null;
  pace: Pace | null;
  interests: Interest[];
  multiCity: boolean;
  cities: string[];
  freeText: string;
  /** Budget max du voyage en euros (activités uniquement, hors logement — voir ROADMAP.md) — optionnel, best-effort côté LLM (jamais une garantie stricte). */
  budgetMaxEur?: number;
}

export function createDefaultAiPreferences(): TripAiPreferences {
  return {
    assistanceLevel: 'activities_day',
    travelerType: 'friends',
    pace: 'balanced',
    interests: [],
    multiCity: false,
    cities: [],
    freeText: '',
  };
}

export const PLANNING_MODE_OPTIONS: SelectButtonOption<PlanningMode>[] = [
  { label: 'Je planifie moi-même', value: 'manual', icon: 'pi pi-pencil' },
  { label: "Laisser l'IA m'aider", value: 'ai', icon: 'pi pi-sparkles' },
];

export const ASSISTANCE_LEVEL_OPTIONS: SelectButtonOption<AssistanceLevel>[] = [
  { label: 'Suggérer des activités', value: 'activities_only' },
  { label: 'Suggérer un parcours', value: 'activities_day' },
  { label: 'Tout planifier', value: 'full_plan' },
];

export const TRAVELER_TYPE_OPTIONS: SelectButtonOption<TravelerType>[] = [
  { label: 'Solo', value: 'solo' },
  { label: 'Couple', value: 'couple' },
  { label: 'Famille', value: 'family' },
  { label: 'Amis', value: 'friends' },
];

export const PACE_OPTIONS: SelectButtonOption<Pace>[] = [
  { label: 'Détente', value: 'relaxed' },
  { label: 'Équilibré', value: 'balanced' },
  { label: 'Intensif', value: 'intense' },
];

export const INTEREST_OPTIONS: { value: Interest; label: string }[] = [
  { value: 'museums', label: 'Musées & culture' },
  { value: 'nature', label: 'Nature & randonnée' },
  { value: 'sport', label: 'Sport' },
  { value: 'food', label: 'Gastronomie' },
  { value: 'nightlife', label: 'Vie nocturne' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'relaxation', label: 'Farniente' },
  { value: 'offbeat', label: 'Insolite' },
];
