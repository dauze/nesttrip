import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent } from '@app/shared/components/layout/card/card.component';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { ProgressSpinnerComponent } from '@app/shared/components/feedback/progress-spinner/progress-spinner.component';
import { TripGenerationRepository } from '@app/core/infra/firebase/services/trip-generation-repository';

/**
 * Écran "On prépare ton voyage..." (process-creation-trip-ia.md §2.4) —
 * observe `tripGenerations/{tripId}` (voir `TripGenerationRepository.watch$`,
 * pas `TripFacade`/`TripStore` : le job de génération est délibérément hors
 * du domaine `Trip`, voir `TripGeneration`).
 *
 * Étapes affichées selon `assistanceLevel` (§2.4) — mais la Cloud Function
 * (`generate-trip.trigger.ts`) exécute tout en un seul passage, sans écrire
 * de statut intermédiaire par étape (une écriture intermédiaire retriggerait
 * `onDocumentWritten` tant que `status` reste `generating` — évité
 * volontairement plutôt que d'ajouter une garde transactionnelle pour un
 * simple affichage) : toutes les étapes listées apparaissent donc "en cours"
 * ensemble tant que `status === 'generating'`, jamais l'une après l'autre.
 */
@Component({
  selector: 'app-generating',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonComponent, ProgressSpinnerComponent],
  templateUrl: './generating.component.html',
  styleUrl: './generating.component.scss',
})
export class GeneratingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripGenerationRepository = inject(TripGenerationRepository);

  protected readonly tripId = this.route.snapshot.paramMap.get('id')!;

  private readonly job = toSignal(this.tripGenerationRepository.watch$(this.tripId), { initialValue: null });

  protected readonly status = computed(() => this.job()?.status ?? 'generating');
  protected readonly error = computed(() => this.job()?.error);

  protected readonly steps = computed<string[]>(() => {
    const level = this.job()?.preferences.assistanceLevel;
    if (level === 'full_plan') return ['Recherche des activités', 'Sélection des logements', 'Organisation du planning'];
    if (level === 'activities_day') return ['Recherche des activités', 'Organisation du planning'];
    return ['Recherche des activités'];
  });

  constructor() {
    // Navigation automatique dès que l'aperçu est prêt — pas d'action
    // utilisateur nécessaire (voir §2.4, le statut piloté par la Cloud
    // Function déclenche directement la suite du parcours).
    effect(() => {
      if (this.status() === 'ready_for_preview') {
        this.router.navigate([`/trips/${this.tripId}/preview`]);
      }
    });
  }

  protected backToManual(): void {
    this.router.navigate([`/trips/${this.tripId}`]);
  }
}
