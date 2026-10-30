import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedActivityCandidate, TripAiPreferences, TripGenerationDoc } from './trip-generation.dto';

interface ActivityAssignment {
  candidateId: string;
  day: number;
}

interface ActivityPlanResponse {
  activities?: ActivityAssignment[];
}

export function applyActivityAssignments(
  candidates: GeneratedActivityCandidate[],
  assignments: unknown,
  numDays: number,
): GeneratedActivityCandidate[] | null {
  if (!Array.isArray(assignments) || assignments.length !== candidates.length || numDays < 1) return null;

  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const seen = new Set<string>();
  const validAssignments: ActivityAssignment[] = [];

  for (const assignment of assignments as ActivityAssignment[]) {
    if (
      !assignment ||
      !candidatesById.has(assignment.candidateId) ||
      seen.has(assignment.candidateId) ||
      !Number.isInteger(assignment.day) ||
      assignment.day < 0 ||
      assignment.day >= numDays
    ) {
      return null;
    }
    seen.add(assignment.candidateId);
    validAssignments.push(assignment);
  }

  if (seen.size !== candidatesById.size) return null;

  return validAssignments
    .map((assignment) => ({ ...candidatesById.get(assignment.candidateId)!, day: assignment.day }))
    .sort((left, right) => left.day! - right.day!);
}

export function distributeActivitiesAcrossDays(
  candidates: GeneratedActivityCandidate[],
  numDays: number,
): GeneratedActivityCandidate[] {
  if (numDays < 1) return candidates;
  return candidates.map((candidate, index) => ({
    ...candidate,
    day: Math.floor((index * numDays) / candidates.length),
  }));
}

export async function planSelectedActivities(
  candidates: GeneratedActivityCandidate[],
  preferences: TripAiPreferences,
  destination: TripGenerationDoc['destination'],
  tripDayDates: number[],
  apiKey: string | undefined,
): Promise<GeneratedActivityCandidate[]> {
  const numDays = tripDayDates.length;
  if (candidates.length === 0 || numDays < 1) {
    throw new Error('Impossible de planifier sans activité sélectionnée et dates de séjour.');
  }

  const fallback = () => distributeActivitiesAcrossDays(candidates, numDays);
  if (!apiKey) return fallback();
  const cities = [...new Set([destination.ville, ...(preferences.multiCity ? preferences.cities : [])])];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        `Tu es un planificateur de voyage expert de ${destination.ville}. Organise uniquement la sélection fournie sur ${numDays} jours.`,
        `Dates des jours : ${tripDayDates.map((date, index) => `jour ${index} = ${new Date(date).toISOString().slice(0, 10)}`).join(', ')}. Utilise-les pour tenir compte des jours de semaine et des horaires d'ouverture connus.`,
        cities.length > 1
          ? `Voyage multi-villes, dans cet ordre : ${cities.join(' → ')}. Regroupe les activités d'une même ville en blocs de jours contigus et utilise l'adresse de chaque lieu pour identifier sa ville.`
          : '',
        `Rythme souhaité : ${preferences.pace ?? 'balanced'}. Centres d'intérêt : ${preferences.interests.join(', ') || 'tous'}.`,
        preferences.freeText ? `Consigne utilisateur à respecter : ${preferences.freeText}` : '',
        'Chaque candidateId doit apparaître exactement une fois. N’ajoute, ne supprime, ne renommes et ne duplique aucune activité. Le champ day est un index de 0 à ' + (numDays - 1) + '. L’ordre du tableau définit l’ordre de visite des activités affectées à un même jour. Répartis les activités de façon réaliste et cohérente géographiquement ; laisse des jours vides si la sélection ne contient pas assez d’activités.',
        `Activités sélectionnées : ${JSON.stringify(candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          title: candidate.title,
          address: candidate.address,
          interest: candidate.interest,
          reason: candidate.reason,
          estimatedDurationMinutes: candidate.estimatedDurationMinutes,
          timeOfDay: candidate.timeOfDay,
        })))}`,
        'Réponds uniquement avec un objet JSON conforme au schéma demandé.',
      ].filter(Boolean).join('\n\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            activities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  candidateId: { type: Type.STRING },
                  day: { type: Type.INTEGER },
                },
                required: ['candidateId', 'day'],
              },
            },
          },
          required: ['activities'],
        },
        maxOutputTokens: 4096,
      },
    });

    const result = JSON.parse(response.text ?? '{}') as ActivityPlanResponse;
    const planned = applyActivityAssignments(candidates, result.activities, numDays);
    if (planned) return planned;

    console.error('planSelectedActivities: réponse LLM incomplète ou invalide, repli déterministe.');
  } catch (err) {
    console.error('planSelectedActivities error, repli déterministe:', err);
  }

  return fallback();
}