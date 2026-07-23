import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
    NgClass,
    TooltipDirective
  ],
  templateUrl: 'accueil-trip.component.html',
})
export class AccueilTripComponent {
  protected readonly tripFacade = inject(TripFacade);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
   private readonly authService = inject(AuthService);
  

  readonly trips = this.tripFacade.trips;
  readonly tripsLoading = this.tripFacade.tripsLoading;
  readonly user = this.authService.getCurrentUser();

  editMode = false;

  // id -> boolean
  selectedTripsMap: Record<string, boolean> = {};

  constructor() {
    //TODO un fix à prévoir, si on a qu'un seul trip, on ne peut plus retourner à la page, il faut mettre un verrou ou le faire sur l'accueil
    // effect(() => {
    //   const trips = this.trips();
    //   if (!this.tripsLoading() && trips.length === 1) {
    //     this.router.navigate(['/trips', trips[0].id], { replaceUrl: true });
    //   }
    // });
  }

  toggleEditMode(): void {
    this.editMode = !this.editMode;

    if (!this.editMode) {
      this.selectedTripsMap = {};
    }
  }

  selectTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }

  toggleTripSelection(tripId: string): void {
    this.selectedTripsMap[tripId] = !this.selectedTripsMap[tripId];
  }

  hasSelection(): boolean {
    return Object.values(this.selectedTripsMap).some(v => v === true);
  }

  getSelectedTripIds(): string[] {
    return Object.entries(this.selectedTripsMap)
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  }

  confirmDelete(): void {
    this.confirmDialogService.confirm({
      message: 'Êtes-vous sûr de vouloir supprimer ces voyages ? Ils seront perdus définitivement.',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      accept: () => {
        const ids = this.getSelectedTripIds();
        this.removeTrips(ids);
        this.selectedTripsMap = {};
        this.editMode = false;
      }
    });
  }

  removeTrips(ids: string[]): void {
    ids.every(i =>  this.tripFacade.removeTrip(i));
  }
}