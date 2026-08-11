import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedActivityCandidate, Pace, TripAiPreferences } from './trip-generation.dto';

/** Même calibrage que le stub (voir select-activities-stub.ts) — cohérence du nombre de suggestions entre les deux chemins (LLM / fallback). */
const ACTIVITIES_PER_DAY: Record<Pace, number> = { relaxed: 2, balanced: 3, intense: 4 };
const PREVIEW_SIZE_NO_DAYS = 10;

/** Un seul champ par candidat envoyé au modèle (§4.1/§4.2) : juste de quoi choisir et justifier, jamais la donnée complète (coordonnées/photos) — inutile pour la sélection, ça alourdirait le prompt pour rien. Les champs complets sont réinjectés après coup via `candidateId` (voir `byId` ci-dessous). */
interface LlmCandidateView {
  candidateId: string;
  title: string;
  interest: string;
  rating?: number;
  address?: string;
}

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      candidateId: { type: Type.STRING },
      day: { type: Type.INTEGER },
      reason: { type: Type.STRING },
    },
    required: ['candidateId', 'reason'],
  },
};

function buildPrompt(
  candidates: LlmCandidateView[],
  preferences: TripAiPreferences,
  numDays: number | undefined,
  targetSize: number,
): string {
  const constraints = [
    preferences.travelerType ? `Type de voyageurs : ${preferences.travelerType}.` : '',
    preferences.pace ? `Rythme souhaité : ${preferences.pace}.` : '',
    preferences.freeText ? `Contexte donné par l'utilisateur : "${preferences.freeText}"` : '',
    numDays ? `Le voyage dure ${numDays} jour(s) — assigne un champ "day" (0-indexé, de 0 à ${numDays - 1}) à chaque activité choisie, réparti raisonnablement.` : 'Ne renseigne PAS de champ "day" (aucun placement par jour dans ce mode).',
  ].filter(Boolean).join('\n');

  return [
    `Tu sélectionnes des activités de voyage pour un itinéraire. Choisis exactement ${targetSize} activités parmi la liste de candidats ci-dessous — RENVOIE UNIQUEMENT des "candidateId" présents dans cette liste, jamais un id inventé, jamais un lieu qui n'y figure pas.`,
    constraints,
    'Varie les centres d\'intérêt représentés plutôt que de piocher dans un seul.',
    'Pour chaque activité choisie, donne une courte raison affichable à l\'utilisateur (ex. "Choisi pour ton intérêt musées").',
    '',
    'Candidats disponibles (JSON) :',
    JSON.stringify(candidates),
  ].join('\n');
}

/**
 * Vrai appel LLM (Gemini, tool use / sortie structurée contrainte au pool de
 * candidats — §4.2) remplaçant `selectActivitiesStub`, même signature (voir
 * sa doc : "remplacer cette seule fonction"). Appelé UNE SEULE FOIS par
 * génération (voir `generate-trip.trigger.ts`) — jamais par candidat, jamais
 * par jour : le pool est déjà réduit en amont (§4.1, max ~50-70 candidats),
 * un seul prompt/une seule réponse pour tout sélectionner d'un coup.
 *
 * Garde-fou anti-hallucination (§4.2/§4.3) : tout `candidateId` renvoyé par
 * le modèle qui ne correspond à AUCUN candidat du pool (ou dupliqué, ou un
 * `day` hors bornes) est silencieusement filtré plutôt que de faire échouer
 * toute la génération — même philosophie que la validation de schéma
 * générale décrite au §4.3.
 */
export async function selectActivitiesLlm(
  candidates: GeneratedActivityCandidate[],
  preferences: TripAiPreferences,
  numDays: number | undefined,
  apiKey: string,
): Promise<GeneratedActivityCandidate[]> {
  const targetSize = numDays
    ? Math.min(candidates.length, ACTIVITIES_PER_DAY[preferences.pace ?? 'balanced'] * numDays)
    : Math.min(candidates.length, PREVIEW_SIZE_NO_DAYS);

  const view: LlmCandidateView[] = candidates.map((c) => ({
    candidateId: c.candidateId,
    title: c.title,
    interest: c.interest,
    ...(c.rating !== undefined ? { rating: c.rating } : {}),
    ...(c.address ? { address: c.address } : {}),
  }));

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    // Flash : modèle le moins cher/rapide de la famille Gemini — largement
    // suffisant pour une tâche de sélection/classement, pas de raisonnement
    // complexe requis (voir la note de coût dans generate-trip.trigger.ts).
    model: 'gemini-2.5-flash',
    contents: buildPrompt(view, preferences, numDays, targetSize),
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 2000,
    },
  });

  const raw = JSON.parse(response.text ?? '[]') as { candidateId: string; day?: number; reason: string }[];

  const byId = new Map(candidates.map((c) => [c.candidateId, c]));
  const seen = new Set<string>();
  const selected: GeneratedActivityCandidate[] = [];

  for (const item of raw) {
    if (seen.has(item.candidateId)) continue;
    const candidate = byId.get(item.candidateId);
    if (!candidate) continue;
    if (numDays !== undefined && (item.day === undefined || item.day < 0 || item.day >= numDays)) continue;

    seen.add(item.candidateId);
    selected.push({
      ...candidate,
      reason: item.reason || candidate.reason,
      ...(numDays !== undefined ? { day: item.day } : {}),
    });
    if (selected.length >= targetSize) break;
  }

  return selected;
}
