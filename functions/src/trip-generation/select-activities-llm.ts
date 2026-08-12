import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedActivityCandidate, Pace, TimeOfDay, TripAiPreferences } from './trip-generation.dto';

const TIME_OF_DAYS: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

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

/** Défauts appliqués quand le LLM omet `duration`/`price` sur un item — jamais bloquants pour la sélection (voir la boucle de parsing plus bas, même philosophie que le traitement de `day`). */
const DEFAULT_DURATION_MINUTES = 120;
const DEFAULT_PRICE_EUR = 0;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      candidateId: { type: Type.STRING },
      day: { type: Type.INTEGER },
      duration: { type: Type.INTEGER },
      price: { type: Type.NUMBER },
      timeOfDay: { type: Type.STRING, enum: TIME_OF_DAYS },
      notes: { type: Type.STRING },
      reason: { type: Type.STRING },
    },
    // `duration`/`price`/`timeOfDay`/`notes` volontairement absents d'ici : un item qui les omet ne doit jamais disparaître de la sélection (retombe sur un défaut au parsing), seul un candidateId/day invalide fait `continue`.
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
    'Pour chaque activité choisie, indique aussi "duration" (durée réaliste en minutes pour une visite, ex. 60 à 180) et "price" (estimation du prix moyen par personne en euros, 0 si gratuit ou inconnu).',
    'Pour chaque activité choisie, indique aussi "timeOfDay" (morning/afternoon/evening/night) : le moment RÉEL où ce lieu (d\'après son titre/adresse/type) a du sens et est ouvert — ex. un bar de nuit/une boîte de nuit → evening ou night, jamais morning/afternoon ; un musée → morning/afternoon ; un dîner → evening.',
    'Pour chaque activité choisie, indique aussi si utile "notes" : une remarque PRATIQUE courte (ex. "Réserver à l\'avance", "Espèces uniquement") — vide si rien à signaler.',
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
    // Alias maintenu à jour par Google plutôt qu'une version datée (ex.
    // "gemini-2.5-flash") — ces dernières finissent retirées ("no longer
    // available to new users") sans avertissement, ce qui faisait
    // silencieusement échouer chaque appel (404) et retomber sur le stub.
    // Flash reste largement suffisant pour une tâche de sélection/classement,
    // pas de raisonnement complexe requis (voir la note de coût dans
    // generate-trip.trigger.ts).
    model: 'gemini-flash-latest',
    contents: buildPrompt(view, preferences, numDays, targetSize),
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // `thinkingConfig: { thinkingBudget: 0 }` a été retiré : sur l'alias
      // `gemini-flash-latest`, ce paramètre fait échouer l'appel à coup sûr
      // avec "400 INVALID_ARGUMENT" (reproduit en conditions réelles avec la
      // clé du projet, 2026-08-11) — c'était la cause du repli systématique
      // sur `selectActivitiesStub`, jamais remarquée faute de log consulté à
      // l'époque. Le modèle "pense" donc par défaut sur cette tâche ; coût
      // marginal acceptable pour un appel unique par génération.
      maxOutputTokens: 4000,
    },
  });

  const raw = JSON.parse(response.text ?? '[]') as { candidateId: string; day?: number; duration?: number; price?: number; timeOfDay?: string; notes?: string; reason: string }[];

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
      estimatedDurationMinutes: Number.isFinite(item.duration) && item.duration! > 0 ? item.duration! : DEFAULT_DURATION_MINUTES,
      estimatedPriceEur: Number.isFinite(item.price) && item.price! >= 0 ? item.price! : DEFAULT_PRICE_EUR,
      ...(TIME_OF_DAYS.includes(item.timeOfDay as TimeOfDay) ? { timeOfDay: item.timeOfDay as TimeOfDay } : {}),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    });
    if (selected.length >= targetSize) break;
  }

  return selected;
}
