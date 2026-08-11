import { GoogleGenAI, Type } from '@google/genai';
import { GeocodedCity } from './geocode-city';
import { Interest, Pace, TripAiPreferences } from './trip-generation.dto';

/** Même calibrage que select-activities-stub.ts/select-activities-llm.ts (chemin de repli) — cohérence du nombre d'activités générées entre les deux chemins. */
const ACTIVITIES_PER_DAY: Record<Pace, number> = { relaxed: 2, balanced: 3, intense: 4 };
const PREVIEW_SIZE_NO_DAYS = 10;

const DEFAULT_DURATION_MINUTES = 120;
const DEFAULT_PRICE_EUR = 0;

const INTERESTS: Interest[] = ['museums', 'nature', 'sport', 'food', 'nightlife', 'shopping', 'relaxation', 'offbeat'];

/** Sortie du chemin primaire (le LLM invente le plan, avant enrichissement Google Places — voir enrich-activities-with-places.ts). Pas encore de placeId/adresse/coordonnées/photos : c'est justement le rôle de l'étape suivante. */
export interface PlannedActivity {
  title: string;
  interest: Interest;
  /** Nom de ville parmi celles transmises (`cities`, voir buildPrompt) — sert uniquement à biaiser la recherche Google Places de l'étape suivante, jamais persisté côté client. Toujours résolu au parsing (repli sur la ville principale), donc pas optionnel une fois `PlannedActivity` construit. */
  city: string;
  /** 0-indexé — uniquement si `numDays` était défini à l'appel. L'ORDRE relatif des activités d'un même jour (tel que renvoyé par le LLM) porte l'ordre de visite voulu — voir buildPrompt : pas d'horaire précis demandé au LLM (voir plus bas), le curseur séquentiel côté client (PreviewComponent.validate) respecte cet ordre. */
  day?: number;
  estimatedDurationMinutes: number;
  estimatedPriceEur: number;
  reason: string;
}

/** Proposition de logement (mode `full_plan` uniquement) — même philosophie "lieu réel choisi par le LLM" que les activités, à la place d'une recherche Google Places générique triée par note (qui remonte systématiquement les grandes enseignes, sans lien avec les préférences de l'utilisateur). */
export interface PlannedLodging {
  city: string;
  title: string;
  reason: string;
}

/**
 * Schéma construit dynamiquement par appel (pas une constante au niveau
 * module) : `city` a besoin de la liste réelle des villes en `enum` — un
 * champ STRING libre sans contrainte s'est avéré risqué (voir plus bas) et
 * un `enum` dynamique le rend aussi strict qu'`interest`. `day`/`duration`/
 * `price` restent des champs simples (INTEGER/NUMBER), pas de format ambigu.
 *
 * IMPORTANT — pas de champ "startTime"/"endTime" ici (contrairement à une
 * version antérieure de ce fichier) : testé en conditions réelles avec la
 * clé du projet (2026-08-12), un champ STRING libre à vocation d'horaire
 * ("HH:mm" attendu mais non contraint par `pattern`/`format`) fait
 * régulièrement dérailler `gemini-flash-latest` en sortie structurée — le
 * modèle "boucle" dans ce champ précis (texte répétitif du type "format HH:mm
 * standard notation...") jusqu'à épuiser `maxOutputTokens`, ne produisant
 * plus qu'UNE SEULE activité au lieu du nombre demandé. Reproduit à
 * l'identique sur plusieurs runs, y compris hors de ce prompt (schéma
 * minimal isolé). Décision actée avec l'utilisateur : les horaires précis
 * ne sont de toute façon pas garantis/vérifiés côté serveur — le mécanisme
 * client existant (curseur séquentiel 09:00 + battement, voir
 * `PreviewComponent.resolveDaySchedule`) suffit pour une v1, l'utilisateur
 * revérifiant lui-même après génération.
 */
function buildResponseSchema(cityNames: string[]) {
  return {
    type: Type.OBJECT,
    properties: {
      activities: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            interest: { type: Type.STRING, enum: INTERESTS },
            city: { type: Type.STRING, enum: cityNames },
            day: { type: Type.INTEGER },
            duration: { type: Type.INTEGER },
            price: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          // Seuls title/reason sont requis : tout le reste (day, durée, prix, intérêt,
          // ville) retombe sur un défaut/une déduction au parsing plutôt que de faire
          // disparaître l'activité — cet appel est bien plus coûteux à refaire qu'une
          // simple sélection (voir select-activities-llm.ts), on ne veut jamais jeter
          // un item pour un champ isolé.
          required: ['title', 'reason'],
        },
      },
      lodging: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING, enum: cityNames },
            title: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ['title', 'reason'],
        },
      },
    },
    required: ['activities'],
  };
}

function buildPrompt(
  cities: GeocodedCity[],
  preferences: TripAiPreferences,
  numDays: number | undefined,
  targetSize: number,
  wantLodging: boolean,
): string {
  const interestLabels = preferences.interests.length ? preferences.interests.join(', ') : 'tous (aucune préférence particulière)';
  const cityNames = cities.map((c) => c.ville);
  const isMultiCity = cities.length > 1;

  const perDayTarget = numDays ? ACTIVITIES_PER_DAY[preferences.pace ?? 'balanced'] : undefined;

  const sections: string[] = [];

  sections.push(
    isMultiCity
      ? `Tu es un guide de voyage local, expert de chacune de ces villes : ${cityNames.join(', ')}. Propose un itinéraire complet pour un voyage qui les couvre TOUTES, dans cet ordre de visite.`
      : `Tu es un guide de voyage local, expert de ${cityNames[0]}. Propose un itinéraire complet pour un voyage à ${cityNames[0]}.`,
  );

  if (isMultiCity && numDays) {
    sections.push(
      `Le séjour dure ${numDays} jour(s) au total, répartis sur ces ${cities.length} villes dans l'ordre donné. Découpe les jours en BLOCS CONTIGUS par ville (ex. jours 0-2 à ${cityNames[0]}, jours 3-4 à ${cityNames[1]}...) — jamais de va-et-vient entre deux villes sur des jours non consécutifs. Pour chaque activité, indique la ville concernée dans "city".`,
    );
  } else if (isMultiCity) {
    sections.push('Répartis les activités entre ces villes. Pour chaque activité, indique la ville concernée dans "city".');
  }

  // --- Contraintes utilisateur : chaque champ de TripAiPreferences est explicitement listé (aucun ne doit être ignoré) ---
  const constraints = [
    preferences.travelerType ? `Type de voyageurs : ${preferences.travelerType}.` : '',
    preferences.pace ? `Rythme souhaité : ${preferences.pace}.` : '',
    `Centres d'intérêt à privilégier : ${interestLabels}.`,
    preferences.budgetMaxEur !== undefined
      ? `Budget total maximum pour l'ENSEMBLE des activités du voyage : ${preferences.budgetMaxEur}€. Priorise des activités gratuites ou peu chères pour rester sous ce budget.`
      : '',
  ].filter(Boolean).join('\n');
  sections.push(constraints);

  if (preferences.freeText) {
    sections.push(
      [
        `CONSIGNE PRIORITAIRE — contexte donné par l'utilisateur, à respecter avant toute autre considération de ce prompt : "${preferences.freeText}"`,
        'Si ce texte exprime une envie précise, une exclusion, ou un style (ex. "hors des sentiers battus", "pas cher", "en famille avec des enfants en bas âge"), il doit se refléter concrètement dans CHAQUE proposition (activités ET logement) — ne retombe jamais sur un choix générique/touristique par défaut si ce texte suggère autre chose. Un choix qui ignore ce texte est un échec, même s\'il est par ailleurs réel et pertinent.',
      ].join(' '),
    );
  }

  sections.push(
    numDays
      ? `Choisis au total environ ${targetSize} activités RÉELLES et actuellement existantes (${cityNames.join(', ')} ou leurs environs proches). Le voyage dure ${numDays} jour(s) : CHAQUE jour de 0 à ${numDays - 1} doit recevoir des activités (environ ${perDayTarget} par jour pour un rythme "${preferences.pace ?? 'balanced'}") — aucun jour ne doit rester vide, c'est une exigence stricte, pas une suggestion. Pour chaque activité, assigne "day" (0-indexé). Au sein d'un même jour, ORDONNE les activités dans le tableau JSON exactement dans l'ordre où elles doivent être visitées (l'application déduira les horaires de cet ordre) — ne les renvoie jamais dans un ordre arbitraire.`
      : `Choisis exactement ${targetSize} activités RÉELLES et actuellement existantes (${cityNames.join(', ')} ou leurs environs proches). Ne renseigne PAS "day" (pas de placement par jour dans ce mode) — indique en revanche "duration" (durée réaliste de la visite en minutes).`,
  );

  sections.push(
    [
      'Cohérence géographique : pour un même jour, regroupe les activités par quartier/zone en t\'appuyant sur ta connaissance réelle de la géographie de la ville — évite les allers-retours d\'un bout à l\'autre de la ville dans la même journée, ordonne-les dans un enchaînement de déplacement logique (voir consigne d\'ordre ci-dessus).',
      'Horaires d\'ouverture : appuie-toi sur ta connaissance réelle de chaque lieu (jours de fermeture connus, créneaux typiques du type d\'établissement — ex. ne place pas un marché qui n\'ouvre que le week-end en début de journée sur un jour de semaine, ni un dîner gastronomique avant les autres activités du jour, ni un lieu réputé fermé le lundi un lundi) pour éviter un enchaînement absurde. Aucune vérification externe n\'est faite derrière toi : ne mentionne un horaire précis dans "reason" que si tu en es réellement certain.',
    ].join('\n'),
  );

  sections.push(
    'Varie les lieux proposés plutôt que de rester sur les incontournables les plus évidents si le contexte utilisateur suggère autre chose (ex. "peu touristique", "hors des sentiers battus").',
  );
  sections.push('Pour chaque activité, indique aussi "price" (estimation du prix moyen par personne en euros, 0 si gratuit) et une courte "reason" affichable à l\'utilisateur (une phrase, ex. "Un marché local peu fréquenté par les touristes").');

  if (wantLodging) {
    sections.push(
      [
        `Logement : propose aussi, dans "lodging", UN établissement RÉEL et actuellement existant par ville (${cityNames.join(', ')}) — jamais un nom inventé ou approximatif.`,
        'Choisis-le pour correspondre au texte libre/type de voyageurs/budget ci-dessus, pas juste le plus connu ou le mieux noté : si l\'utilisateur mentionne par exemple "auberge de jeunesse", "pas cher", "chambre d\'hôtes" ou "insolite", ne propose SURTOUT PAS un grand hôtel générique de chaîne (ex. Pullman, Novotel, Hilton) — cherche une vraie pépite qui correspond précisément à la demande, quitte à être moins connue. Sans indication particulière de l\'utilisateur, un bon compromis qualité/emplacement/prix reste attendu.',
        'Renseigne "reason" pour expliquer ce choix par rapport à la demande de l\'utilisateur.',
      ].join(' '),
    );
  }

  sections.push('Réponds uniquement avec un objet JSON conforme au schéma demandé, sans texte autour. "reason" doit rester concise (une phrase courte).');

  return sections.filter(Boolean).join('\n\n');
}

interface RawPlannedActivity {
  title?: string;
  interest?: string;
  city?: string;
  day?: number;
  duration?: number;
  price?: number;
  reason?: string;
}

interface RawPlannedLodging {
  city?: string;
  title?: string;
  reason?: string;
}

interface RawPlanResponse {
  activities?: RawPlannedActivity[];
  lodging?: RawPlannedLodging[];
}

function resolveDuration(item: RawPlannedActivity): number {
  return Number.isFinite(item.duration) && item.duration! > 0 ? item.duration! : DEFAULT_DURATION_MINUTES;
}

function resolveCity(name: string | undefined, cities: GeocodedCity[]): string {
  const primary = cities[0].ville;
  if (!name) return primary;
  const match = cities.find((c) => c.ville.toLowerCase() === name.toLowerCase());
  return match ? match.ville : primary;
}

/**
 * Chemin primaire de génération (remplace l'ancien enchaînement recherche
 * Google par catégorie → sélection LLM, voir generate-trip.trigger.ts) : le
 * LLM invente directement l'itinéraire (et, en mode `full_plan`, les
 * logements) à partir des préférences complètes, SANS pool Google fourni en
 * entrée — voir enrich-activities-with-places.ts pour l'étape suivante qui
 * ancre chaque proposition dans un vrai lieu Google (garde-fou
 * anti-hallucination : une activité/un logement que Google ne retrouve pas
 * est écarté là-bas, pas ici).
 *
 * "Thinking" volontairement laissé actif (pas de `thinkingConfig`,
 * contrairement à select-activities-llm.ts — voir sa doc pour la raison :
 * ce paramètre fait échouer l'appel sur `gemini-flash-latest`) : la tâche
 * n'est de toute façon plus une sélection triviale mais une vraie
 * planification (connaissance de la ville, cohérence géographique de
 * l'enchaînement, arithmétique de budget, choix de logement).
 */
export async function planTripLlm(
  preferences: TripAiPreferences,
  cities: GeocodedCity[],
  numDays: number | undefined,
  apiKey: string,
): Promise<{ activities: PlannedActivity[]; lodging: PlannedLodging[] }> {
  const targetSize = numDays
    ? ACTIVITIES_PER_DAY[preferences.pace ?? 'balanced'] * numDays
    : PREVIEW_SIZE_NO_DAYS;
  const wantLodging = preferences.assistanceLevel === 'full_plan';
  const cityNames = cities.map((c) => c.ville);

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: buildPrompt(cities, preferences, numDays, targetSize, wantLodging),
    config: {
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(cityNames),
      maxOutputTokens: 12000,
    },
  });

  const raw = JSON.parse(response.text ?? '{}') as RawPlanResponse;

  const seenTitles = new Set<string>();
  const activities: PlannedActivity[] = [];

  (raw.activities ?? []).forEach((item, index) => {
    const title = item.title?.trim();
    if (!title) return;
    const key = title.toLowerCase();
    if (seenTitles.has(key)) return;
    seenTitles.add(key);

    const interest = INTERESTS.includes(item.interest as Interest) ? (item.interest as Interest) : 'offbeat';
    const day = numDays !== undefined
      ? (typeof item.day === 'number' && item.day >= 0 && item.day < numDays ? item.day : index % numDays)
      : undefined;

    activities.push({
      title,
      interest,
      city: resolveCity(item.city, cities),
      ...(day !== undefined ? { day } : {}),
      estimatedDurationMinutes: resolveDuration(item),
      estimatedPriceEur: Number.isFinite(item.price) && item.price! >= 0 ? item.price! : DEFAULT_PRICE_EUR,
      reason: item.reason?.trim() || `Choisi pour ton intérêt ${interest}`,
    });
  });

  const lodging: PlannedLodging[] = [];
  if (wantLodging) {
    const seenLodgingCities = new Set<string>();
    for (const item of raw.lodging ?? []) {
      const title = item.title?.trim();
      if (!title) continue;
      const city = resolveCity(item.city, cities);
      if (seenLodgingCities.has(city)) continue;
      seenLodgingCities.add(city);
      lodging.push({ city, title, reason: item.reason?.trim() || `Logement à ${city}` });
    }
  }

  return { activities: activities.slice(0, targetSize), lodging };
}
