import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CardComponent } from '@app/shared/components/card/card.component';
import { Trip, Day } from '../trip.model';
import { Notes } from '../trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { AuthService } from '@app/core/services/auth.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import { PlaceSummary } from '@app/core/models/place.dto';
import { TripFacade } from '../trip-facade.service';

@Component({
  selector: 'app-new-trip',
  standalone: true,
  imports: [
    ReactiveFormsModule, InputTextDirective, DatePickerComponent, ButtonComponent,
    CardComponent, AutoCompleteComponent
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

  onSelect(place: PlaceSummary): void {
    this.form.patchValue({
      ville: place.name,
      placeId: place.placeId,
    });
  }

  onSearch(query: string): void {
    this.googlePlaceService.setSearchTerm(query ?? '');
  }

  protected displayPlaceName(place: PlaceSummary): string {
    return place.name;
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
      activities: [],
      dayActivityInstances: [],
      notes: this.buildNote(),
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
      days.push({ id: new Date(current), activityIds: [] });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private buildNote(): Notes {
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