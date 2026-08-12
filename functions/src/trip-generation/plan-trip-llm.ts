import { GoogleGenAI, Type } from '@google/genai';
import { GeocodedCity } from './geocode-city';
import { Interest, Pace, TimeOfDay, TripAiPreferences } from './trip-generation.dto';

/** Même calibrage que select-activities-stub.ts/select-activities-llm.ts (chemin de repli) — cohérence du nombre d'activités générées entre les deux chemins. */
const ACTIVITIES_PER_DAY: Record<Pace, number> = { relaxed: 2, balanced: 3, intense: 4 };
const PREVIEW_SIZE_NO_DAYS = 10;
/** Déjeuner + dîner mandatés chaque jour (voir buildPrompt) — délibérément PAS ajouté à ACTIVITIES_PER_DAY : cette constante reste le "même calibrage" partagé avec select-activities-stub.ts/select-activities-llm.ts (repli, pas de mandat repas). N'affecte que le calcul local de perDayTarget/targetSize de ce fichier. */
const MEAL_SLOTS_PER_DAY = 2;

const DEFAULT_DURATION_MINUTES = 120;
const DEFAULT_PRICE_EUR = 0;

const INTERESTS: Interest[] = ['museums', 'nature', 'sport', 'food', 'nightlife', 'shopping', 'relaxation', 'offbeat'];
const TIME_OF_DAYS: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

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
  /** Moment de la journée réaliste (ouverture/ambiance du lieu, ex. boîte de nuit → night) — voir buildResponseSchema pour pourquoi c'est un ENUM et pas un horaire précis. */
  timeOfDay?: TimeOfDay;
  /** Horaire de départ suggéré (0-1439, minutes depuis 00:00) — résolu depuis suggestedStartHour/suggestedStartMinute au parsing (voir resolveStartMinutes). INTEGER par activité, pas un STRING "HH:mm" (voir la doc de buildResponseSchema pour la raison). Consommé par PreviewComponent.resolveDaySchedule en priorité sur timeOfDay. */
  suggestedStartMinutes?: number;
  /** Remarque pratique courte (réservation à l'avance, espèces uniquement, tenue exigée...) — distinct de `reason` (justification du choix, affichée différemment). Va dans DayActivityInstance.notes à la validation. */
  notes?: string;
}

/** Note générale de voyage générée par le LLM (packing list, choses à ne pas oublier...) — devient un `Item` du système de notes existant à la validation (voir notes.model.ts côté client), optionnellement lié à une activité précise via `relatedActivityIndex` (résolu dans CE fichier, voir planTripLlm, avant tout risque de dérive de titre à l'enrichissement Google). */
export interface PlannedGeneralNote {
  title: string;
  type: 'TODO' | 'INFO';
  points: string[];
  /** Index dans le tableau `activities` final (post-dédoublonnage, avant enrichissement) — résolu depuis le `relatedActivityTitle` recopié par le LLM, voir planTripLlm. `undefined` = note générale non liée. */
  relatedActivityIndex?: number;
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
 * ne sont de toute façon pas garantis/vérifiés côté serveur.
 *
 * En remplacement (2026-08-12, retour utilisateur : horaires/moments pas
 * cohérents — ex. boîte de nuit proposée l'après-midi), deux champs d'une
 * autre nature, structurellement éloignés du STRING libre qui avait cassé la
 * sortie : `timeOfDay` par activité est un ENUM (même forme qu'`interest`,
 * déjà fiable) plutôt qu'un horaire précis ; `dayStartHour`/`dayEndHour` sont
 * des INTEGER **top-level** (une seule fois par réponse, pas par activité,
 * même forme que `day`/`duration`/`price` déjà fiables). Le curseur horaire
 * réel reste calculé côté client (`PreviewComponent.resolveDaySchedule`), qui
 * consomme ces trois champs pour placer/plafonner les horaires plutôt que
 * d'empiler aveuglément depuis 09:00 — voir sa doc.
 *
 * Retour utilisateur du 2026-08-12 (correctif précédent insuffisant pour
 * activities_day/full_plan) : les 4 buckets `timeOfDay` restaient trop
 * grossiers pour un vrai planning. Ajout de `suggestedStartHour`/
 * `suggestedStartMinute` par activité — DEUX `Type.INTEGER`, pas UN STRING
 * "HH:mm" : même raisonnement que `dayStartHour`/`dayEndHour` ci-dessus, un
 * entier n'a pas de format sur lequel "boucler". `timeOfDay` reste le repli
 * quand l'heure est absente/non fiable (voir PreviewComponent). `generalNotes`
 * (packing list, choses à ne pas oublier) est un tableau top-level séparé, pas
 * lié à `activities` par un id direct (voir planTripLlm pour la résolution
 * par titre → index, faite ici plutôt qu'en aval pour éviter toute dérive de
 * titre à l'enrichissement Google).
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
            timeOfDay: { type: Type.STRING, enum: TIME_OF_DAYS },
            // INTEGER, pas un STRING "HH:mm" — voir la doc au-dessus de cette fonction.
            suggestedStartHour: { type: Type.INTEGER },
            suggestedStartMinute: { type: Type.INTEGER },
            notes: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          // Seuls title/reason sont requis : tout le reste (day, durée, prix, intérêt,
          // ville, moment de la journée, horaire suggéré, remarque) retombe sur un défaut/une
          // déduction au parsing plutôt que de faire disparaître l'activité — cet appel est
          // bien plus coûteux à refaire qu'une simple sélection (voir select-activities-llm.ts),
          // on ne veut jamais jeter un item pour un champ isolé.
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
      // Renseignés uniquement si preferences.freeText exprime une heure de début/fin de
      // journée souhaitée (voir buildPrompt) — top-level, pas par activité : un seul couple
      // de valeurs pour tout le voyage, cohérent avec le curseur unique de PreviewComponent.
      dayStartHour: { type: Type.INTEGER },
      dayEndHour: { type: Type.INTEGER },
      // Notes générales de voyage (packing list, choses à ne pas oublier...) — voir
      // PlannedGeneralNote. `points` reste un tableau de STRING simples (pas de format
      // imposé) — même risque qu'un STRING libre déjà fiable (`reason`), juste répété.
      generalNotes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['TODO', 'INFO'] },
            points: { type: Type.ARRAY, items: { type: Type.STRING } },
            relatedActivityTitle: { type: Type.STRING },
          },
          required: ['title', 'points'],
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

  // + MEAL_SLOTS_PER_DAY : le mandat repas (déjeuner+dîner, voir plus bas) s'ajoute au rythme
  // choisi, il ne le remplace pas — doit rester en lockstep avec targetSize dans planTripLlm.
  const perDayTarget = numDays ? ACTIVITIES_PER_DAY[preferences.pace ?? 'balanced'] + MEAL_SLOTS_PER_DAY : undefined;

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
        'Si ce texte exprime une heure de début et/ou de fin de journée souhaitée (ex. "commencer à 11h", "terminer vers 2h du matin", "je me lève tard"), renseigne "dayStartHour" et/ou "dayEndHour" en heure 24h (entier 0 à 23, ex. 2 pour "2h du matin") — une seule valeur pour tout le voyage, pas par jour. Sinon, ne renseigne NI l\'un NI l\'autre (ne devine pas une heure qui n\'est pas exprimée).',
      ].join(' '),
    );
  }

  sections.push(
    numDays
      ? `Choisis au total environ ${targetSize} activités RÉELLES et actuellement existantes (${cityNames.join(', ')} ou leurs environs proches). Le voyage dure ${numDays} jour(s) : CHAQUE jour de 0 à ${numDays - 1} doit recevoir des activités (environ ${perDayTarget} par jour pour un rythme "${preferences.pace ?? 'balanced'}", REPAS COMPRIS — voir consigne repas ci-dessous) — aucun jour ne doit rester vide, c'est une exigence stricte, pas une suggestion. Pour chaque activité, assigne "day" (0-indexé). Au sein d'un même jour, ORDONNE les activités dans le tableau JSON exactement dans l'ordre où elles doivent être visitées (l'application déduira les horaires de cet ordre) — ne les renvoie jamais dans un ordre arbitraire.`
      : `Choisis exactement ${targetSize} activités RÉELLES et actuellement existantes (${cityNames.join(', ')} ou leurs environs proches). Ne renseigne PAS "day" (pas de placement par jour dans ce mode) — indique en revanche "duration" (durée réaliste de la visite en minutes).`,
  );

  if (numDays) {
    sections.push(
      [
        'Repas : CHAQUE jour doit inclure un déjeuner ET un dîner (interest "food"), sauf indication contraire explicite du texte libre (ex. "pas de restaurant le soir", "je cuisine moi-même" → dans ce cas ne mandate pas ce repas-là). Une contrainte de budget ou de régime alimentaire dans le texte libre ne supprime PAS le mandat, elle doit juste orienter LEQUEL proposer (moins cher, végétarien, etc.).',
        'Place ces repas aux horaires RÉELS de déjeuner/dîner de la ville/du pays visité — raisonne sur les habitudes locales réelles (ex. dîner nettement plus tardif en Espagne qu\'au Japon), ne retombe JAMAIS par défaut sur des horaires français si la destination est ailleurs.',
      ].join(' '),
    );
  }

  sections.push(
    [
      'Cohérence géographique : pour un même jour, regroupe les activités par quartier/zone en t\'appuyant sur ta connaissance réelle de la géographie de la ville — évite les allers-retours d\'un bout à l\'autre de la ville dans la même journée, ordonne-les dans un enchaînement de déplacement logique (voir consigne d\'ordre ci-dessus).',
      'Horaires d\'ouverture : appuie-toi sur ta connaissance réelle de chaque lieu (jours de fermeture connus, créneaux typiques du type d\'établissement — ex. ne place pas un marché qui n\'ouvre que le week-end en début de journée sur un jour de semaine, ni un dîner gastronomique avant les autres activités du jour, ni un lieu réputé fermé le lundi un lundi) pour éviter un enchaînement absurde. Aucune vérification externe n\'est faite derrière toi : ne mentionne un horaire précis dans "reason" que si tu en es réellement certain.',
      'Pour CHAQUE activité, renseigne aussi "timeOfDay" (morning/afternoon/evening/night) : le moment RÉEL où ce lieu a du sens et est ouvert, pas un simple remplissage — ex. un marché matinal → morning, un musée → morning/afternoon, un dîner → evening, une boîte de nuit/un bar de nuit → evening ou night. Ne mets JAMAIS une activité de vie nocturne (bar de nuit, club, discothèque) en morning/afternoon : ces lieux sont fermés ou sans intérêt à ces heures-là.',
      ...(numDays
        ? [
          'Réfléchis à l\'échelle du SÉJOUR ENTIER, pas activité par activité : en plus de "timeOfDay", renseigne "suggestedStartHour" (0-23) et "suggestedStartMinute" (0-59) pour CHAQUE activité — un horaire réaliste qui évite les heures d\'affluence connues des lieux très fréquentés (ex. ouverture en haute saison, début d\'après-midi pour un site iconique) au profit d\'un créneau plus calme et tout aussi valable (tôt le matin, fin de journée...) quand tu le sais. Tu peux mentionner un événement récurrent ou ponctuel que tu connais avec certitude (marché hebdomadaire, marché de Noël saisonnier...), mais n\'en invente JAMAIS un dont tu n\'es pas sûr. Si tu n\'es pas confiant sur l\'horaire précis d\'une activité, NE renseigne PAS "suggestedStartHour"/"suggestedStartMinute" pour elle et laisse "timeOfDay" porter l\'information — mieux vaut omettre que deviner.',
        ]
        : []),
    ].join('\n'),
  );

  sections.push(
    'Varie les lieux proposés plutôt que de rester sur les incontournables les plus évidents si le contexte utilisateur suggère autre chose (ex. "peu touristique", "hors des sentiers battus").',
  );
  sections.push('Pour chaque activité, indique aussi "price" (estimation du prix moyen par personne en euros, 0 si gratuit), une courte "reason" affichable à l\'utilisateur (une phrase, ex. "Un marché local peu fréquenté par les touristes"), et si utile "notes" : une remarque PRATIQUE courte et concrète (ex. "Réserver à l\'avance, souvent complet", "Paiement en espèces uniquement", "Tenue correcte exigée") — différent de "reason" (qui justifie le choix). Laisse "notes" vide s\'il n\'y a rien de particulier à signaler.');

  if (wantLodging) {
    sections.push(
      [
        `Logement : propose aussi, dans "lodging", UN établissement RÉEL et actuellement existant par ville (${cityNames.join(', ')}) — jamais un nom inventé ou approximatif.`,
        'Choisis-le pour correspondre au texte libre/type de voyageurs/budget ci-dessus, pas juste le plus connu ou le mieux noté : si l\'utilisateur mentionne par exemple "auberge de jeunesse", "pas cher", "chambre d\'hôtes" ou "insolite", ne propose SURTOUT PAS un grand hôtel générique de chaîne (ex. Pullman, Novotel, Hilton) — cherche une vraie pépite qui correspond précisément à la demande, quitte à être moins connue. Sans indication particulière de l\'utilisateur, un bon compromis qualité/emplacement/prix reste attendu.',
        'Renseigne "reason" pour expliquer ce choix par rapport à la demande de l\'utilisateur.',
      ].join(' '),
    );
  }

  sections.push(
    [
      'Dans "generalNotes", propose 1 à 4 notes générales de voyage RÉELLEMENT spécifiques à ce voyage précis (destination, saison, activités choisies, texte libre) — jamais une liste générique de conseils touristiques passe-partout. Pour chacune : "title" court, "type" "TODO" (liste à cocher, ex. "À emporter") ou "INFO" (une information importante à garder en tête), "points" (2 à 6 lignes courtes).',
      'Si une note concerne précisément une des activités proposées ci-dessus (ex. rappel de réservation, équipement nécessaire pour cette activité), recopie EXACTEMENT son "title" tel que tu l\'as toi-même écrit dans "relatedActivityTitle" — sinon laisse ce champ vide.',
    ].join(' '),
  );

  sections.push('Réponds uniquement avec un objet JSON conforme au schéma demandé, sans texte autour. "reason"/"notes" doivent rester concis (une phrase courte).');

  return sections.filter(Boolean).join('\n\n');
}

interface RawPlannedActivity {
  title?: string;
  interest?: string;
  city?: string;
  day?: number;
  duration?: number;
  price?: number;
  timeOfDay?: string;
  suggestedStartHour?: number;
  suggestedStartMinute?: number;
  notes?: string;
  reason?: string;
}

interface RawPlannedLodging {
  city?: string;
  title?: string;
  reason?: string;
}

interface RawPlannedGeneralNote {
  title?: string;
  type?: string;
  points?: string[];
  relatedActivityTitle?: string;
}

interface RawPlanResponse {
  activities?: RawPlannedActivity[];
  lodging?: RawPlannedLodging[];
  dayStartHour?: number;
  dayEndHour?: number;
  generalNotes?: RawPlannedGeneralNote[];
}

/** Cap défensif — au cas où le LLM ignorerait la consigne "2 à 6 lignes" du prompt. */
const MAX_NOTE_POINTS = 6;

function resolveDuration(item: RawPlannedActivity): number {
  return Number.isFinite(item.duration) && item.duration! > 0 ? item.duration! : DEFAULT_DURATION_MINUTES;
}

function resolveTimeOfDay(item: RawPlannedActivity): TimeOfDay | undefined {
  return TIME_OF_DAYS.includes(item.timeOfDay as TimeOfDay) ? (item.timeOfDay as TimeOfDay) : undefined;
}

/** 0-23 uniquement — toute autre valeur (absente, hors bornes, non entière) est ignorée plutôt que corrigée, pour ne jamais deviner une heure que le LLM n'a pas réellement détectée dans le texte libre. */
function resolveDayHour(value: number | undefined): number | undefined {
  return Number.isInteger(value) && value! >= 0 && value! <= 23 ? value : undefined;
}

/** Heure invalide/absente ⇒ pas de suggestion du tout (jamais d'horaire deviné). Heure valide mais minute invalide/absente ⇒ minute par défaut 0 (ne jette jamais l'heure pour un champ isolé, même philosophie que resolveDuration/le prix). */
function resolveStartMinutes(item: RawPlannedActivity): number | undefined {
  const hour = resolveDayHour(item.suggestedStartHour);
  if (hour === undefined) return undefined;
  const minute = Number.isInteger(item.suggestedStartMinute) && item.suggestedStartMinute! >= 0 && item.suggestedStartMinute! <= 59
    ? item.suggestedStartMinute!
    : 0;
  return hour * 60 + minute;
}

function resolveNotes(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
): Promise<{ activities: PlannedActivity[]; lodging: PlannedLodging[]; dayStartHour?: number; dayEndHour?: number; generalNotes: PlannedGeneralNote[] }> {
  // + MEAL_SLOTS_PER_DAY : doit rester en lockstep avec perDayTarget dans buildPrompt (voir sa doc).
  const targetSize = numDays
    ? (ACTIVITIES_PER_DAY[preferences.pace ?? 'balanced'] + MEAL_SLOTS_PER_DAY) * numDays
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
      // 12000 → 20000 (2026-08-12) : plus de champs par activité (suggestedStartHour/Minute,
      // notes) + MEAL_SLOTS_PER_DAY en plus par jour + nouveau tableau generalNotes — à
      // reconfirmer en conditions réelles comme les précédents changements de schéma de ce fichier.
      maxOutputTokens: 20000,
    },
  });

  const raw = JSON.parse(response.text ?? '{}') as RawPlanResponse;

  const seenTitles = new Set<string>();
  // Index dans le tableau `activities` FINAL (post-dédoublonnage) — construit ici, avant tout
  // risque de dérive (enrichissement Google, plafond budget, exclusion utilisateur en aperçu).
  // Voir PlannedGeneralNote.relatedActivityIndex.
  const titleToIndex = new Map<string, number>();
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

    titleToIndex.set(key, activities.length);
    activities.push({
      title,
      interest,
      city: resolveCity(item.city, cities),
      ...(day !== undefined ? { day } : {}),
      estimatedDurationMinutes: resolveDuration(item),
      estimatedPriceEur: Number.isFinite(item.price) && item.price! >= 0 ? item.price! : DEFAULT_PRICE_EUR,
      ...(resolveTimeOfDay(item) ? { timeOfDay: resolveTimeOfDay(item) } : {}),
      ...(resolveStartMinutes(item) !== undefined ? { suggestedStartMinutes: resolveStartMinutes(item) } : {}),
      ...(resolveNotes(item.notes) ? { notes: resolveNotes(item.notes) } : {}),
      reason: item.reason?.trim() || `Choisi pour ton intérêt ${interest}`,
    });
  });

  // Résolution du titre recopié par le LLM → index dans `activities` (pré-slice, voir plus bas —
  // un .slice(0, targetSize) ne réordonne pas, donc tout index < targetSize reste valide après).
  const generalNotes: PlannedGeneralNote[] = (raw.generalNotes ?? [])
    .map((item): PlannedGeneralNote | null => {
      const title = item.title?.trim();
      const points = (item.points ?? []).map((p) => p?.trim()).filter((p): p is string => !!p).slice(0, MAX_NOTE_POINTS);
      if (!title || points.length === 0) return null;
      const type = item.type === 'INFO' ? 'INFO' : 'TODO';
      const relatedKey = item.relatedActivityTitle?.trim().toLowerCase();
      const relatedActivityIndex = relatedKey ? titleToIndex.get(relatedKey) : undefined;
      return { title, type, points, ...(relatedActivityIndex !== undefined ? { relatedActivityIndex } : {}) };
    })
    .filter((n): n is PlannedGeneralNote => n !== null);

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

  return {
    activities: activities.slice(0, targetSize),
    lodging,
    dayStartHour: resolveDayHour(raw.dayStartHour),
    dayEndHour: resolveDayHour(raw.dayEndHour),
    generalNotes,
  };
}
