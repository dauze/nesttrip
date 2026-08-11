import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ProgressSpinnerComponent } from '@app/shared/components/progress-spinner/progress-spinner.component';
import { TripGenerationRepository } from '@app/core/infra/firebase/services/trip-generation-repository';

/**
 * Écran "On prépare ton voyage..." (process-creation-trip-ia.md §2.4) —
 * observe `tripGenerations/{tripId}` (voir `TripGenerationRepository.watch$`,
 * pas `TripFacade`/`TripStore` : le job de génération est délibérément hors
 * du domaine `Trip`, voir `TripGeneration`). Une seule étape affichée : Lot 2
 * ne couvre que `activities_only` ("Recherche des activités" seulement, voir
 * §2.4 — `full_plan`/`activities_day` afficheraient logements/planning en
 * plus, non implémenté ici).
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
