import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { TripGenerationRepository } from '@app/core/infra/firebase/services/trip-generation-repository';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GeneratedActivityCandidate, GeneratedGeneralNote, GeneratedLodgingCandidate, GeneratedTransportSegment, NoteType, TimeOfDay, TripGeneration } from '@app/features/trips/new-trip/trip-generation.model';
import { Interest } from '@app/features/trips/new-trip/trip-ai-preferences.model';
import { DayActivityInstance, PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { minutesToTime, timeToMinutes } from '@app/shared/components/activity-card/activity-time.util';
import { Logistic } from '@core/models/logistic.dto';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { NotesType } from '@core/enums/notes.type';
import { Item } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/notes/notes.model';

interface DayGroup {
  dayIndex: number;
  date: Date;
  items: GeneratedActivityCandidate[];
}

/** Défaut si le LLM (ou le stub) n'a pas fourni de durée exploitable — voir select-activities-llm.ts/select-activities-stub.ts. */
const DEFAULT_DURATION_MINUTES = 120;
/** Horaires dérivés à la validation (§6, décision : pas de champ horaire précis demandé au LLM, non fiable sur des listes longues) — départ par défaut si `job.dayStartHour` n'a pas été détecté (voir `TripGeneration.dayStartHour`, plan-trip-llm.ts). */
const DAY_START_TIME = '09:00';
const GAP_MINUTES = 30;

/**
 * Fenêtres horaires indicatives par `timeOfDay` (voir `GeneratedActivityCandidate.timeOfDay`,
 * détecté par le LLM à partir de sa connaissance réelle du lieu — ex. boîte de nuit → night).
 * Utilisées par `resolveDaySchedule` pour "sauter" au créneau réaliste plutôt que d'empiler
 * aveuglément les activités à la suite — voir sa doc. `night` peut légitimement déborder sur le
 * lendemain (`endDayOffset`), pattern déjà supporté par `DayActivityInstance`/`activity-time.util.ts`.
 */
const TIME_OF_DAY_START_MINUTES: Record<TimeOfDay, number> = {
  morning: 9 * 60,
  afternoon: 12 * 60,
  evening: 18 * 60,
  night: 21 * 60,
};
const DEFAULT_TIME_OF_DAY: TimeOfDay = 'afternoon';

/** `NotesType.TODO === 'CHECKLIST'`, pas `'TODO'` — un cast direct de `GeneratedGeneralNote.type` écrirait la mauvaise valeur Firestore, d'où ce mapping explicite. */
const GENERATED_NOTE_TYPE_TO_NOTES_TYPE: Record<NoteType, NotesType> = {
  TODO: NotesType.TODO,
  INFO: NotesType.INFO,
};

/** Type d'activité déduit du centre d'intérêt ayant produit le candidat (recherche Google Places, voir search-activities.ts) — défaut ACTIVITE pour les intérêts sans correspondance directe. */
const INTEREST_TO_ACTIVITY_TYPE: Record<Interest, ActivityType> = {
  museums: ActivityType.VISITE,
  nature: ActivityType.NATURE,
  sport: ActivityType.ACTIVITE,
  food: ActivityType.REPAS,
  nightlife: ActivityType.ACTIVITE,
  shopping: ActivityType.SHOPPING,
  relaxation: ActivityType.DETENTE,
  offbeat: ActivityType.ACTIVITE,
};

/**
 * Écran d'aperçu (process-creation-trip-ia.md §2.5) — 3 niveaux :
 * `activities_only` (liste plate, pas de jour), `activities_day` (groupé par
 * jour, pas de logement/transport), `full_plan` (idem + logements + trajets
 * estimés entre villes).
 *
 * "Rien n'est écrit dans le voyage réel avant validation" (§2.5) : `items`/
 * `lodgingItems` sont des copies locales de `job().preview`/`lodgingPreview`,
 * éditées librement (exclusion, remplacement — pioché dans
 * `job().candidates`/`lodgingCandidates`, déjà en cache, jamais de nouvel
 * appel réseau, voir §2.6) sans toucher Firestore. Seul "Valider" écrit
 * réellement : activités via `TripFacade.createActivity`/`createGeneralActivity`
 * (placée sur le jour assigné si `day` est renseigné), logements/trajets via
 * `TripFacade.createLogistic` — mêmes commandes que la création manuelle
 * (voir CLAUDE.md), avec `PoolActivity.source: 'ai_generated'` pour les
 * activités (badge "Suggéré par IA" — pas encore de concept de provenance
 * équivalent sur `Logistic`, hors scope de cette session).
 */
@Component({
  selector: 'app-trip-generation-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonComponent, CheckboxComponent, NgTemplateOutlet, DatePipe],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.scss',
})
export class PreviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripGenerationRepository = inject(TripGenerationRepository);
  private readonly tripFacade = inject(TripFacade);

  protected readonly tripId = this.route.snapshot.paramMap.get('id')!;

  private readonly job = toSignal(this.tripGenerationRepository.watch$(this.tripId), { initialValue: null });

  protected readonly items = signal<GeneratedActivityCandidate[]>([]);
  protected readonly lodgingItems = signal<GeneratedLodgingCandidate[]>([]);
  protected readonly transportSegments = signal<GeneratedTransportSegment[]>([]);
  protected readonly generalNotesItems = signal<GeneratedGeneralNote[]>([]);
  protected readonly validating = signal(false);
  private lastSyncedStatus: string | null = null;

  protected readonly hasDayPlacement = computed(() => this.items().some((i) => i.day !== undefined));

  protected readonly dayGroups = computed<DayGroup[]>(() => {
    const job = this.job();
    if (!job) return [];
    const groups = new Map<number, GeneratedActivityCandidate[]>();
    for (const item of this.items()) {
      if (item.day === undefined) continue;
      const bucket = groups.get(item.day) ?? [];
      bucket.push(item);
      groups.set(item.day, bucket);
    }
    return job.tripDayDates
      .map((epoch, dayIndex) => ({ dayIndex, date: new Date(epoch), items: groups.get(dayIndex) ?? [] }))
      .filter((g) => g.items.length > 0);
  });

  protected readonly lodgingByCity = computed<{ city: string; items: GeneratedLodgingCandidate[] }[]>(() => {
    const byCity = new Map<string, GeneratedLodgingCandidate[]>();
    for (const item of this.lodgingItems()) {
      const bucket = byCity.get(item.city) ?? [];
      bucket.push(item);
      byCity.set(item.city, bucket);
    }
    return [...byCity.entries()].map(([city, items]) => ({ city, items }));
  });

  constructor() {
    // Resynchronise l'état local depuis Firestore uniquement au passage À
    // `ready_for_preview` (première apparition de l'aperçu, ou après
    // "Régénérer tout") — jamais à chaque snapshot, qui écraserait sinon les
    // exclusions/remplacements locaux en cours d'édition (rien de tout ça
    // n'est encore persisté, voir doc de classe).
    effect(() => {
      const job = this.job();
      if (!job) return;
      if (job.status === 'ready_for_preview' && this.lastSyncedStatus !== 'ready_for_preview') {
        this.items.set(job.preview);
        this.lodgingItems.set(job.lodgingPreview);
        this.transportSegments.set(job.transportSegments);
        this.generalNotesItems.set(job.generalNotes);
      }
      this.lastSyncedStatus = job.status;
    });
  }

  // --- Activités ---

  protected toggleExclude(candidateId: string): void {
    this.items.update((list) => list.map((c) => (c.candidateId === candidateId ? { ...c, excluded: !c.excluded } : c)));
  }

  /** Pioche un autre candidat du même centre d'intérêt dans `job().candidates` (déjà en cache) — no-op si épuisé (voir `canReplace`, le bouton est désactivé dans ce cas). */
  protected replace(candidateId: string): void {
    const job = this.job();
    if (!job) return;
    const current = this.items();
    const target = current.find((c) => c.candidateId === candidateId);
    if (!target) return;

    const usedIds = new Set(current.map((c) => c.candidateId));
    const replacement = job.candidates.find((c) => c.interest === target.interest && !usedIds.has(c.candidateId));
    if (!replacement) return;

    this.items.update((list) => list.map((c) => (c.candidateId === candidateId ? { ...replacement, day: target.day, excluded: false } : c)));
  }

  protected canReplace(item: GeneratedActivityCandidate): boolean {
    const job = this.job();
    if (!job) return false;
    const usedIds = new Set(this.items().map((c) => c.candidateId));
    return job.candidates.some((c) => c.interest === item.interest && !usedIds.has(c.candidateId));
  }

  // --- Logements (mode full_plan) ---

  protected toggleExcludeLodging(candidateId: string): void {
    this.lodgingItems.update((list) => list.map((c) => (c.candidateId === candidateId ? { ...c, excluded: !c.excluded } : c)));
  }

  protected replaceLodging(candidateId: string): void {
    const job = this.job();
    if (!job) return;
    const current = this.lodgingItems();
    const target = current.find((c) => c.candidateId === candidateId);
    if (!target) return;

    const usedIds = new Set(current.map((c) => c.candidateId));
    const replacement = job.lodgingCandidates.find((c) => c.city === target.city && !usedIds.has(c.candidateId));
    if (!replacement) return;

    this.lodgingItems.update((list) => list.map((c) => (c.candidateId === candidateId ? { ...replacement, excluded: false } : c)));
  }

  protected canReplaceLodging(item: GeneratedLodgingCandidate): boolean {
    const job = this.job();
    if (!job) return false;
    const usedIds = new Set(this.lodgingItems().map((c) => c.candidateId));
    return job.lodgingCandidates.some((c) => c.city === item.city && !usedIds.has(c.candidateId));
  }

  // --- Notes générales (chemin primaire) ---

  protected toggleExcludeGeneralNote(id: string): void {
    this.generalNotesItems.update((list) => list.map((n) => (n.id === id ? { ...n, excluded: !n.excluded } : n)));
  }

  // --- Actions globales ---

  protected regenerateAll(): void {
    const job = this.job();
    if (!job) return;
    this.tripGenerationRepository.regenerate(this.tripId, job.preferences);
    this.router.navigate([`/trips/${this.tripId}/generating`]);
  }

  protected validate(): void {
    const job = this.job();
    if (!job) return;
    this.validating.set(true);

    const byDay = new Map<number, GeneratedActivityCandidate[]>();
    const withoutDay: GeneratedActivityCandidate[] = [];
    for (const item of this.items()) {
      if (item.excluded) continue;
      if (item.day !== undefined && job.tripDayDates[item.day] !== undefined) {
        const bucket = byDay.get(item.day) ?? [];
        bucket.push(item);
        byDay.set(item.day, bucket);
      } else {
        withoutDay.push(item);
      }
    }

    // Modes activities_day/full_plan : aucun chemin de génération ne fournit d'horaire précis par
    // activité (voir plan-trip-llm.ts — un champ horaire libre par activité s'est avéré faire
    // dérailler la sortie structurée du LLM) — l'ordre des activités dans `dayItems` (celui renvoyé
    // par le LLM/le stub) reste toujours respecté tel quel, mais l'horaire n'est plus un simple
    // empilement : voir resolveDaySchedule/resolveDayWindow (timeOfDay, dayStartHour/dayEndHour).
    const { startMinutes: dayStartMinutes, endMinutesAbs: dayEndMinutesAbs } = this.resolveDayWindow(job);

    // candidateId (identité stable côté serveur, voir generate-trip.trigger.ts) -> instanceId
    // fraîchement créé ici — permet de résoudre GeneratedGeneralNote.relatedCandidateId en un
    // vrai Item.linkedActivityInstanceId plus bas, une fois les deux boucles terminées.
    const candidateIdToInstanceId = new Map<string, string>();

    for (const [day, dayItems] of byDay) {
      let cursorMinutes = dayStartMinutes;
      for (const item of dayItems) {
        const schedule = this.resolveDaySchedule(item, cursorMinutes);
        // Jamais démarrer une NOUVELLE activité après minuit (seule la fin d'une activité en
        // cours peut déborder sur le lendemain, via endDayOffset) ni après l'heure de fin voulue
        // par l'utilisateur si détectée — le curseur étant monotone, tout ce qui suit échouerait
        // aussi ce test : on arrête ce jour-là plutôt que de continuer à empiler (même logique
        // "plafonnage a posteriori" que apply-budget-cap.ts côté serveur).
        if (schedule.startMinutes >= 1440) break;
        if (dayEndMinutesAbs !== undefined && schedule.startMinutes >= dayEndMinutesAbs) break;

        const poolActivity = this.buildPoolActivity(item);
        const instance: DayActivityInstance = {
          id: crypto.randomUUID(),
          activityId: poolActivity.id,
          type: INTEREST_TO_ACTIVITY_TYPE[item.interest],
          duration: schedule.duration,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          ...(schedule.endDayOffset ? { endDayOffset: schedule.endDayOffset } : {}),
          price: { amount: item.estimatedPriceEur ?? 0, currency: 'EUR' },
          booking: { status: BookingStatus.NOT_NEEDED },
          notes: item.notes ?? '',
        };
        cursorMinutes = schedule.startMinutes + schedule.duration + GAP_MINUTES;
        candidateIdToInstanceId.set(item.candidateId, instance.id);

        this.tripFacade.createActivity(this.tripId, new Date(job.tripDayDates[day]), poolActivity, instance);
      }
    }

    // Mode activities_only : pas de jour, donc pas d'horaire — instance "orpheline" (voir TripStore.createGeneralActivity) pour porter type/durée/prix réels sur la carte pool.
    for (const item of withoutDay) {
      const poolActivity = this.buildPoolActivity(item);
      const instance: DayActivityInstance = {
        id: crypto.randomUUID(),
        activityId: poolActivity.id,
        type: INTEREST_TO_ACTIVITY_TYPE[item.interest],
        duration: item.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES,
        price: { amount: item.estimatedPriceEur ?? 0, currency: 'EUR' },
        booking: { status: BookingStatus.NOT_NEEDED },
        notes: item.notes ?? '',
      };
      candidateIdToInstanceId.set(item.candidateId, instance.id);
      this.tripFacade.createGeneralActivity(this.tripId, poolActivity, instance);
    }

    // Notes générales de voyage (chemin primaire uniquement, voir plan-trip-llm.ts) — créées comme
    // de vrais Item du système de notes existant (voir notes.model.ts), liées à l'activité créée
    // ci-dessus si relatedCandidateId matche une instance effectivement créée (activité exclue ou
    // jamais retrouvée par Google ⇒ note créée SANS lien plutôt que perdue).
    for (const note of this.generalNotesItems()) {
      if (note.excluded) continue;
      const linkedActivityInstanceId = note.relatedCandidateId ? candidateIdToInstanceId.get(note.relatedCandidateId) : undefined;
      const item: Item = {
        id: crypto.randomUUID(),
        title: note.title,
        type: GENERATED_NOTE_TYPE_TO_NOTES_TYPE[note.type],
        elements: note.points.map((text) => ({ id: crypto.randomUUID(), text, checked: false })),
        ...(linkedActivityInstanceId ? { linkedActivityInstanceId } : {}),
      };
      this.tripFacade.createItem(this.tripId, item);
    }

    for (const item of this.lodgingItems()) {
      if (item.excluded) continue;
      this.tripFacade.createLogistic(this.tripId, this.buildLodgingLogistic(item));
    }

    for (const segment of this.transportSegments()) {
      this.tripFacade.createLogistic(this.tripId, this.buildTransportLogistic(segment));
    }

    this.router.navigate([`/trips/${this.tripId}`]);
  }

  /** Heure de début du jour (`job.dayStartHour` si détecté par le LLM, sinon défaut historique 09:00) et heure de fin absolue en minutes depuis 00:00 du jour de début (`job.dayEndHour`, "+1 jour" si elle tombe avant/à l'heure de début — ex. début 11h/fin 2h ⇒ fin réelle à 26h). */
  private resolveDayWindow(job: TripGeneration): { startMinutes: number; endMinutesAbs?: number } {
    const startMinutes = job.dayStartHour !== undefined ? job.dayStartHour * 60 : timeToMinutes(DAY_START_TIME);
    const endMinutesAbs = job.dayEndHour === undefined
      ? undefined
      : job.dayEndHour * 60 <= startMinutes ? job.dayEndHour * 60 + 1440 : job.dayEndHour * 60;
    return { startMinutes, endMinutesAbs };
  }

  /**
   * Dérive le créneau réel d'une activité à partir du curseur du jour : au lieu d'empiler
   * aveuglément à la suite, "saute" à l'horaire suggéré par le LLM (`suggestedStartMinutes`,
   * chemin primaire uniquement) s'il est présent, sinon au créneau réaliste de son `timeOfDay`
   * (voir TIME_OF_DAY_START_MINUTES) — cible dépassée par le curseur ⇒ ignorée, ne recule jamais,
   * ne réordonne jamais (l'ordre du LLM/du stub reste toujours respecté). `endDayOffset` posé
   * explicitement dès que la fin dépasse minuit (créneau `night`, déjà supporté par
   * `DayActivityInstance`/`activity-time.util.ts`).
   */
  private resolveDaySchedule(item: GeneratedActivityCandidate, cursorMinutes: number): { startMinutes: number; startTime: string; endTime: string; duration: number; endDayOffset: number } {
    const duration = item.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES;
    const targetMinutes = item.suggestedStartMinutes ?? TIME_OF_DAY_START_MINUTES[item.timeOfDay ?? DEFAULT_TIME_OF_DAY];
    const startMinutes = Math.max(cursorMinutes, targetMinutes);
    const endMinutesAbs = startMinutes + duration;
    return {
      startMinutes,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutesAbs),
      duration,
      endDayOffset: endMinutesAbs >= 1440 ? 1 : 0,
    };
  }

  private buildPoolActivity(item: GeneratedActivityCandidate): PoolActivity {
    return {
      id: crypto.randomUUID(),
      title: item.title,
      files: [],
      photoRefs: item.photoRefs,
      source: 'ai_generated',
      ...(item.placeId ? { placeId: item.placeId } : {}),
      ...(item.address ? { address: item.address } : {}),
      ...(item.latitude !== undefined ? { latitude: item.latitude } : {}),
      ...(item.longitude !== undefined ? { longitude: item.longitude } : {}),
    };
  }

  private buildLodgingLogistic(item: GeneratedLodgingCandidate): Logistic {
    return {
      id: crypto.randomUUID(),
      type: 'logement',
      title: item.title,
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
      notes: `Suggéré par IA — ${item.city}`,
      place: {
        placeId: item.placeId,
        name: item.title,
        address: item.address ?? '',
        latitude: item.latitude ?? 0,
        longitude: item.longitude ?? 0,
      },
    };
  }

  /** Type `'train'` par défaut (pas de mode réel connu — estimation générique, voir §6) : `departurePlace`/`arrivalPlace` restent absents, aucune coordonnée de ville disponible à ce stade (voir `GeneratedTransportSegment`). */
  private buildTransportLogistic(segment: GeneratedTransportSegment): Logistic {
    return {
      id: crypto.randomUUID(),
      type: 'train',
      title: `Trajet estimé ${segment.fromCity} → ${segment.toCity}`,
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
      notes: segment.estimatedLabel,
    };
  }
}
