import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TravelStore } from '@features/trips/travel.service';

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [CardModule, ButtonModule, SkeletonModule],
  templateUrl: 'trip-list.component.html',
  styleUrl: 'trip-list.component.scss',
})
export class TripListComponent implements OnInit {
  protected readonly travelStore = inject(TravelStore);
  private readonly router = inject(Router);

  readonly skeletons = [1, 2, 3];

  ngOnInit(): void {
    this.travelStore.loadTrips();
  }

  selectTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }
}