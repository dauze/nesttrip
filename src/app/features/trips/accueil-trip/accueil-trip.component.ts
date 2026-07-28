import { Component, effect, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectionModeService } from '@app/shared/services/selection-mode.service';
import { SelectionActionBarComponent } from '@app/shared/components/selection-action-bar/selection-action-bar.component';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { TripFacade } from '../trip-facade.service';
import { AuthService } from '@app/core/services/auth.service';
import { NgClass } from '@angular/common';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';

@Component({
  selector: 'app-accueil-trip',
  standalone: true,
  imports: [
    CardComponent,
    ButtonComponent,
    SkeletonComponent,
    MessageComponent,
    RouterModule,
    CheckboxComponent,
    NgClass,
    TooltipDirective,
    SelectableDirective,
    LongPressDirective,
    SelectionActionBarComponent,
  ],
  templateUrl: 'accueil-trip.component.html',
  // Une instance dédiée (voir SelectionModeService) : le mode sélection de
  // cet écran ne doit jamais se mélanger avec celui de trip-detail.
  providers: [SelectionModeService],
})
export class AccueilTripComponent {
  protected readonly tripFacade = inject(TripFacade);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly authService = inject(AuthService);
  protected readonly selectionService = inject(SelectionModeService);

  readonly trips = this.tripFacade.trips;
  readonly tripsLoading = this.tripFacade.tripsLoading;
  readonly user = this.authService.getCurrentUser();

  constructor() {
    // Redirection directe vers l'unique trip, UNIQUEMENT à l'ouverture de la
    // web app (juste après un login, voir AuthService.justLoggedIn) — jamais
    // lors d'un retour manuel depuis un trip, sinon impossible de revenir
    // sur cet écran (voir ROADMAP.md, tentative précédente désactivée pour
    // cette raison). Consommé une seule fois, dès que le chargement des
    // trips aboutit, quel que soit leur nombre.
    effect(() => {
      if (!this.authService.justLoggedIn() || this.tripsLoading()) return;

      this.authService.justLoggedIn.set(false);
      const trips = this.trips();
      if (trips.length === 1) this.router.navigate(['/trips', trips[0].id]);
    });
  }

  selectTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }

  onSelectionCancel(): void {
    this.selectionService.cancel();
  }

  onSelectionDelete(): void {
    const ids = this.selectionService.values().map((ref) => ref.id);
    if (ids.length === 0) return;

    const plural = ids.length > 1 ? 's' : '';
    this.confirmDialogService.confirm({
      message: `Êtes-vous sûr de vouloir supprimer ${ids.length > 1 ? 'ces' : 'ce'} voyage${plural} ? Il${plural} ser${plural ? 'ont' : 'a'} perdu${plural} définitivement.`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      accept: () => {
        for (const id of ids) this.tripFacade.removeTrip(id);
        this.selectionService.cancel();
      },
    });
  }
}
