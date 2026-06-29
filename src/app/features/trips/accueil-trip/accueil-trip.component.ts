import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FormsModule } from '@angular/forms';
import { TripFacade } from '../trip-facade.service';

@Component({
  selector: 'app-accueil-trip',
  standalone: true,
  imports: [
    CardModule,
    ButtonModule,
    SkeletonModule,
    MessageModule,
    RouterModule,
    CheckboxModule,
    ConfirmDialogModule,
    FormsModule
  ],
  providers: [ConfirmationService],
  templateUrl: 'accueil-trip.component.html',
})
export class AccueilTripComponent {
  protected readonly tripFacade = inject(TripFacade);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);

  readonly trips = this.tripFacade.trips;
  readonly tripsLoading = this.tripFacade.tripsLoading;

  editMode = false;

  // id -> boolean
  selectedTripsMap: Record<string, boolean> = {};

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
      .filter(([_, selected]) => selected)
      .map(([id]) => id);
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
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