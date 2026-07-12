import { Component, computed, inject, input } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';

import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { TextareaModule } from 'primeng/textarea';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityType } from '@core/enums/activites-type.enum';
import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_OPTIONS, BOOKING_STATUS_META, BOOKING_STATUS_OPTIONS, CURRENCY_OPTIONS } from '../activity.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';

@Component({
  selector: 'app-activity-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, NgClass,
    SelectModule, InputNumberModule, DatePickerModule, DividerModule, TextareaModule,
  ],
  templateUrl: './activity-form.component.html',
  styleUrl: './activity-form.component.scss',
})
export class ActivityFormComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly fb = inject(FormBuilder);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly activity = input.required<Activity>();

  readonly activityTypeOptions = ACTIVITY_TYPE_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;

  readonly form = this.fb.group({
    type: this.fb.nonNullable.control<ActivityType>(ActivityType.ACTIVITE),
    duration: this.fb.nonNullable.control<number>(0),
    notes: this.fb.nonNullable.control<string>(''),
    startTime: this.fb.control<Date | null>(null),
    endTime: this.fb.control<Date | null>(null),
    booking: this.fb.group({
      status: this.fb.nonNullable.control<BookingStatus>(BookingStatus.NOT_NEEDED),
      deadline: this.fb.control<Date | null>(null),
    }),
    price: this.fb.group({
      amount: this.fb.nonNullable.control<number>(0),
      currency: this.fb.nonNullable.control<string>('EUR'),
    }),
  });

  readonly bookingMeta = computed(() => {
    const status = this.formValue().booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });
  
  // Remplacement du contrôle texte par un contrôle Date pour le p-datepicker
  readonly durationTimeControl = this.fb.control<Date | null>(null);

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly showDeadline = computed(() => {
    const status = this.formValue().booking?.status ?? BookingStatus.NOT_NEEDED;
    return [BookingStatus.TO_BOOK, BookingStatus.WAITLIST].includes(status);
  });

  readonly isDeadlineSoon = computed(() => {
    const deadline = this.formValue().booking?.deadline;
    if (!deadline) return false;
    return new Date(deadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  });

  private editCounter = 0;
  private readonly lastEdited: Record<'startTime' | 'endTime' | 'duration', number> = {
    startTime: 0, endTime: 0, duration: 0,
  };
  private isProgrammaticUpdate = false;

  constructor() {
    runOnceReady(this.activity, (a) => {
      // On force la date de dayId sur le startTime et endTime reçus si présents
      const patchedActivity = {
        ...a,
        startTime: this.applyDayIdDate(a.startTime ? new Date(a.startTime) : null),
        endTime: this.applyDayIdDate(a.endTime ? new Date(a.endTime) : null),
      };

      this.form.patchValue(patchedActivity);
      this.initDurationFromForm();
    });

    this.form.valueChanges.pipe(
      debounceTime(300),
      takeUntilDestroyed(),
    ).subscribe((value) => {
      const activity = this.activity();
      this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        ...value,
        startTime: value.startTime ?? undefined,
        endTime: value.endTime ?? undefined,
        booking: { ...activity.booking, ...value.booking, deadline: value.booking?.deadline ?? undefined },
        price: { ...activity.price, ...value.price },
      });
    });

    this.setupTimeDurationSync();
  }

  private setupTimeDurationSync(): void {
    // Gestion du changement de la durée via p-datepicker
    this.durationTimeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((date) => {
      if (this.isProgrammaticUpdate || !date) return;
      
      const minutes = date.getHours() * 60 + date.getMinutes();

      this.lastEdited.duration = ++this.editCounter;
      this.isProgrammaticUpdate = true;
      this.form.controls.duration.setValue(minutes, { emitEvent: false });
      this.isProgrammaticUpdate = false;

      this.recalculateFrom('duration');
    });

    this.form.controls.startTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
      if (this.isProgrammaticUpdate || !start) return;

      // On s'assure que la date sélectionnée prend bien le jour de dayId()
      const normalizedStart = this.applyDayIdDate(start)!;
      this.isProgrammaticUpdate = true;
      this.form.controls.startTime.setValue(normalizedStart, { emitEvent: false });
      this.isProgrammaticUpdate = false;

      this.lastEdited.startTime = ++this.editCounter;
      this.recalculateFrom('startTime');
    });

    this.form.controls.endTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((end) => {
      if (this.isProgrammaticUpdate || !end) return;

      // On s'assure que la date sélectionnée prend bien le jour de dayId()
      const normalizedEnd = this.applyDayIdDate(end)!;
      this.isProgrammaticUpdate = true;
      this.form.controls.endTime.setValue(normalizedEnd, { emitEvent: false });
      this.isProgrammaticUpdate = false;

      this.lastEdited.endTime = ++this.editCounter;
      this.recalculateFrom('endTime');
    });
  }

  private recalculateFrom(changed: 'startTime' | 'endTime' | 'duration'): void {
    const start = this.form.controls.startTime.value;
    const end = this.form.controls.endTime.value;
    const duration = this.form.controls.duration.value;

    this.isProgrammaticUpdate = true;

    if (changed === 'duration') {
      if (start) this.setEndFromStartAndDuration(start, duration);
      else if (end) this.setStartFromEndAndDuration(end, duration);
      this.syncDurationTimeControlFromForm();
      this.isProgrammaticUpdate = false;
      return;
    }

    if (changed === 'startTime') {
      if (!start) { this.isProgrammaticUpdate = false; return; }
      const shouldKeepEnd = !!end && this.lastEdited.endTime >= this.lastEdited.duration;
      if (shouldKeepEnd) this.setDurationFromStartAndEnd(start, end);
      else this.setEndFromStartAndDuration(start, duration);
      this.isProgrammaticUpdate = false;
      return;
    }

    // changed === 'endTime'
    if (!end) { this.isProgrammaticUpdate = false; return; }
    const shouldKeepStart = !!start && this.lastEdited.startTime >= this.lastEdited.duration;
    if (shouldKeepStart) this.setDurationFromStartAndEnd(start, end);
    else this.setStartFromEndAndDuration(end, duration);
    this.isProgrammaticUpdate = false;
  }

  private setDurationFromStartAndEnd(start: Date, end: Date): void {
    let diff = this.toMinutes(end) - this.toMinutes(start);
    if (diff < 0) diff += 24 * 60;
    this.form.controls.duration.setValue(diff, { emitEvent: false });
    this.syncDurationTimeControlFromForm();
  }

  private setEndFromStartAndDuration(start: Date, duration: number): void {
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    // On s'assure que la date recalculée respecte aussi dayId
    this.form.controls.endTime.setValue(this.applyDayIdDate(end), { emitEvent: false });
  }

  private setStartFromEndAndDuration(end: Date, duration: number): void {
    const start = new Date(end);
    start.setMinutes(start.getMinutes() - duration);
    // On s'assure que la date recalculée respecte aussi dayId
    this.form.controls.startTime.setValue(this.applyDayIdDate(start), { emitEvent: false });
  }

  private toMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  /**
   * Synchronise le composant de saisie p-datepicker de la durée depuis les minutes du formulaire
   */
  private syncDurationTimeControlFromForm(): void {
    const totalMinutes = this.form.controls.duration.value ?? 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const durationDate = new Date();
    durationDate.setHours(hours, minutes, 0, 0);
    
    this.durationTimeControl.setValue(durationDate, { emitEvent: false });
  }

  /**
   * Injecte la date (Année/Mois/Jour) du dayId() dans l'objet Date fourni en conservant ses heures/minutes.
   */
  private applyDayIdDate(time: Date | null): Date | null {
    if (!time) return null;
    const base = new Date(this.dayId());
    base.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return base;
  }

  private initDurationFromForm(): void {
    const start = this.form.controls.startTime.value;
    const end = this.form.controls.endTime.value;
    const duration = this.form.controls.duration.value;

    if (duration > 0) { this.syncDurationTimeControlFromForm(); return; }
    if (start && end) {
      this.isProgrammaticUpdate = true;
      this.setDurationFromStartAndEnd(start, end);
      this.isProgrammaticUpdate = false;
      return;
    }
    this.syncDurationTimeControlFromForm();
  }
}