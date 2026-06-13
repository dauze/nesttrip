import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FluidModule } from 'primeng/fluid';
import { Trip, Day } from '../trip.model';
import { Info } from '../trip-detail/infos/info.models';
import { TripStore } from '../trip-store.service';
import { AuthService } from '@app/core/services/auth.service';

@Component({
  selector: 'app-new-trip',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    DatePickerModule,
    ButtonModule,
    CardModule,
    FluidModule,
  ],
  templateUrl: 'new-trip.component.html',
})
export class NewTripComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tripStore = inject(TripStore);
  private readonly authService = inject(AuthService);

  readonly form = this.fb.group({
    title: ['', Validators.required],
    ville: ['', Validators.required],
    dateDebut: [null as Date | null, Validators.required],
    dateFin: [null as Date | null, Validators.required],
  });

  get minDateFin(): Date | null {
    return this.form.value.dateDebut ?? null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const uid = this.authService.getCurrentUser()?.uid;
    if (!uid) throw new Error('User not authenticated');

    const { title, ville, dateDebut, dateFin } = this.form.value as {
      title: string;
      ville: string;
      dateDebut: Date;
      dateFin: Date;
    };

    const trip: Trip = {
      id: crypto.randomUUID(),
      title,
      ville,
      days: this.buildDays(dateDebut, dateFin),
      info: this.buildInfo(),
      ownerId: uid,
      members: { [uid]: 'owner' },
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
    this.tripStore.saveTrip(trip);
    this.router.navigate([`/trips/${trip.id}`]);
  }

  onCancel(): void {
    this.router.navigate(['/trips']);
  }
}