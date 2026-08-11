import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { TripGenerationRepository } from '@app/core/infra/firebase/services/trip-generation-repository';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GeneratedActivityCandidate, GeneratedLodgingCandidate, GeneratedTransportSegment } from '@app/features/trips/new-trip/trip-generation.model';
import { Interest } from '@app/features/trips/new-trip/trip-ai-preferences.model';
import { DayActivityInstance, PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { minutesToTime, timeToMinutes } from '@app/shared/components/activity-card/activity-time.util';
import { Logistic } from '@core/models/logistic.dto';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';

interface DayGroup {
  dayIndex: number;
  date: Date;
  items: GeneratedActivityCandidate[];
}

/** Défaut si le LLM (ou le stub) n'a pas fourni de durée exploitable — voir select-activities-llm.ts/select-activities-stub.ts. */
const DEFAULT_DURATION_MINUTES = 120;
/** Horaires dérivés à la validation (§6, décision : pas de champ horaire demandé au LLM, non fiable sur des listes longues) : premier créneau du jour, puis enchaînement séquentiel avec ce battement entre deux activités. */
const DAY_START_TIME = '09:00';
const GAP_MINUTES = 30;

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

    // Modes activities_day/full_plan : aucun chemin de génération ne fournit d'horaire précis (voir plan-trip-llm.ts —
    // un champ horaire libre s'est avéré faire dérailler la sortie structurée du LLM) — l'ordre des activités dans
    // `dayItems` (celui renvoyé par le LLM/le stub) est en revanche significatif, on en déduit un horaire séquentiel.
    for (const [day, dayItems] of byDay) {
      let cursorMinutes = timeToMinutes(DAY_START_TIME);
      for (const item of dayItems) {
        const poolActivity = this.buildPoolActivity(item);
        const { startTime, endTime, duration } = this.resolveDaySchedule(item, cursorMinutes);
        const instance: DayActivityInstance = {
          id: crypto.randomUUID(),
          activityId: poolActivity.id,
          type: INTEREST_TO_ACTIVITY_TYPE[item.interest],
          duration,
          startTime,
          endTime,
          price: { amount: item.estimatedPriceEur ?? 0, currency: 'EUR' },
          booking: { status: BookingStatus.NOT_NEEDED },
          notes: '',
        };
        cursorMinutes += duration + GAP_MINUTES;

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
        notes: '',
      };
      this.tripFacade.createGeneralActivity(this.tripId, poolActivity, instance);
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

  /** Aucun chemin de génération ne fournit d'horaire précis (voir plan-trip-llm.ts) — dérive toujours un créneau séquentiel à partir du curseur du jour et de la durée estimée. */
  private resolveDaySchedule(item: GeneratedActivityCandidate, cursorMinutes: number): { startTime: string; endTime: string; duration: number } {
    const duration = item.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES;
    return { startTime: minutesToTime(cursorMinutes), endTime: minutesToTime(cursorMinutes + duration), duration };
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
