import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FluidModule } from 'primeng/fluid';
import { Trip, Day } from '../trip.model';
import { Info } from '../trip-detail/trip-day-swiper/infos/info.models';
import { AuthService } from '@app/core/services/auth.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { PlaceSummary } from '@app/core/models/place.dto';
import { TripFacade } from '../trip-facade.service';

@Component({
  selector: 'app-new-trip',
  standalone: true,
  imports: [
    ReactiveFormsModule, InputTextModule, DatePickerModule, ButtonModule,
    CardModule, FluidModule, AutoComplete
  ],
  templateUrl: 'new-trip.component.html',
})
export class NewTripComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tripFacade = inject(TripFacade);
  private readonly authService = inject(AuthService);
  private readonly googlePlaceService = inject(GooglePlaceService);

  private readonly rawPlaces = this.googlePlaceService.places;

  readonly form = this.fb.group({
    title: ['', Validators.required],
    ville: ['', Validators.required],
    placeId: [''],
    dates: [null, Validators.required],
  });

  readonly loading = signal(false);
  readonly searching = this.googlePlaceService.searching;

  private titleManuallyEdited = false;

  constructor() {
    this.form.controls.ville.valueChanges.subscribe((ville) => {
      if (this.titleManuallyEdited) return;
      const suggestion = ville ? `Road trip ${ville}` : '';
      this.form.controls.title.setValue(suggestion, { emitEvent: false });
    });

    this.form.controls.title.valueChanges.subscribe(() => {
      if (!this.titleManuallyEdited) this.titleManuallyEdited = true;
    });
  }

  readonly placesWithPhotos = computed(() => {
    const list = this.rawPlaces();
    if (!list) return [];
      return list;
  });

  onSelect(event: AutoCompleteSelectEvent): void {
    const place = event.value as PlaceSummary;
    this.form.patchValue({
      ville: place.name,
      placeId: place.placeId,
    });
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const [dateDebut, dateFin] = this.form.value.dates || [];

    const trip: Trip = {
      id: crypto.randomUUID(),
      title: this.form.value.title ?? '',
      ville: this.form.value.ville ?? '',
      placeId: this.form.value.placeId ?? '',
      days: this.buildDays(dateDebut, dateFin),
      info: this.buildInfo(),
      ownerId: user.uid,
      members: {
        [user.uid]: { role: 'owner', email: user.email ?? '', displayName: user.displayName ?? undefined },
      },
    };

    this.saveTrip(trip);
  }

  private buildDays(start: Date, end: Date): Day[] {
    const days: Day[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);
    while (current <= endNorm) {
      days.push({ id: new Date(current), activities: [] });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private buildInfo(): Info {
    return { id: crypto.randomUUID(), items: [] };
  }

  private saveTrip(trip: Trip): void {
    this.tripFacade.saveTrip(trip);
    this.router.navigate([`/trips/${trip.id}`]);
  }

  onCancel(): void {
    this.router.navigate(['/trips']);
  }
}