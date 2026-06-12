import { Component, inject,} from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TravelStore } from '../travel.store';

@Component({
  selector: 'app-accueil-trip',
  standalone: true,
  imports: [CardModule, ButtonModule, SkeletonModule],
  templateUrl: 'accueil-trip.component.html',
  styleUrl: 'accueil-trip.component.scss',
})
export class AccueilTripComponent {
  protected readonly travelStore = inject(TravelStore);
  private readonly router = inject(Router);

  readonly trips = this.travelStore.trips;
  readonly tripsLoading = this.travelStore.tripsLoading;

  selectTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }
}