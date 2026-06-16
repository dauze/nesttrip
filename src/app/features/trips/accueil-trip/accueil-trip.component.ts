import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { TripStore } from '../trip-store.service';

@Component({
  selector: 'app-accueil-trip',
  standalone: true,
  imports: [CardModule, ButtonModule, SkeletonModule, MessageModule, RouterModule],
  templateUrl: 'accueil-trip.component.html',
})
export class AccueilTripComponent {
  protected readonly tripStore = inject(TripStore);
  private readonly router = inject(Router);

  readonly trips = this.tripStore.trips;
  readonly tripsLoading = this.tripStore.tripsLoading;

  selectTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }
}