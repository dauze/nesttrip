import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { TripGenerationRepository } from '@app/core/infra/firebase/services/trip-generation-repository';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GeneratedActivityCandidate } from '@app/features/trips/new-trip/trip-generation.model';
import { PoolActivity } from '@app/shared/components/activity-card/activity.model';

/**
 * Écran d'aperçu (process-creation-trip-ia.md §2.5) — mode `activities_only`
 * uniquement (Lot 2) : liste plate d'activités proposées, chacune avec
 * Exclure/Remplacer, "Régénérer tout"/"Valider" en bas.
 *
 * "Rien n'est écrit dans le voyage réel avant validation" (§2.5) : `items`
 * est une copie locale de `job().preview`, éditée librement (exclusion,
 * remplacement — pioché dans `job().candidates`, déjà en cache, jamais de
 * nouvel appel réseau, voir §2.6) sans toucher Firestore. Seul "Valider"
 * écrit réellement, via `TripFacade.createGeneralActivity` (même commande
 * que la création manuelle d'une activité de pool — voir CLAUDE.md), avec
 * `source: 'ai_generated'`.
 */
@Component({
  selector: 'app-trip-generation-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonComponent, CheckboxComponent],
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
  protected readonly validating = signal(false);
  private lastSyncedStatus: string | null = null;

  constructor() {
    // Resynchronise `items` depuis Firestore uniquement au passage À
    // `ready_for_preview` (première apparition de l'aperçu, ou après
    // "Régénérer tout") — jamais à chaque snapshot, qui écraserait sinon les
    // exclusions/remplacements locaux en cours d'édition (rien de tout ça
    // n'est encore persisté, voir doc de classe).
    effect(() => {
      const job = this.job();
      if (!job) return;
      if (job.status === 'ready_for_preview' && this.lastSyncedStatus !== 'ready_for_preview') {
        this.items.set(job.preview);
      }
      this.lastSyncedStatus = job.status;
    });
  }

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

    this.items.update((list) => list.map((c) => (c.candidateId === candidateId ? { ...replacement, excluded: false } : c)));
  }

  protected canReplace(item: GeneratedActivityCandidate): boolean {
    const job = this.job();
    if (!job) return false;
    const usedIds = new Set(this.items().map((c) => c.candidateId));
    return job.candidates.some((c) => c.interest === item.interest && !usedIds.has(c.candidateId));
  }

  protected regenerateAll(): void {
    const job = this.job();
    if (!job) return;
    this.tripGenerationRepository.regenerate(this.tripId, job.preferences);
    this.router.navigate([`/trips/${this.tripId}/generating`]);
  }

  protected validate(): void {
    this.validating.set(true);
    for (const item of this.items()) {
      if (item.excluded) continue;

      const poolActivity: PoolActivity = {
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
      this.tripFacade.createGeneralActivity(this.tripId, poolActivity);
    }
    this.router.navigate([`/trips/${this.tripId}`]);
  }
}
