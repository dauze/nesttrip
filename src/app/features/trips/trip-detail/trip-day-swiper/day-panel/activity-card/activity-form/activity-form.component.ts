import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';

import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { InputMask } from 'primeng/inputmask';
import { DividerModule } from 'primeng/divider';
import { TextareaModule } from 'primeng/textarea';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityType } from '@core/enums/activites-type.enum';
import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_OPTIONS, BOOKING_STATUS_OPTIONS, CURRENCY_OPTIONS } from '../activity.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';

@Component({
  selector: 'app-activity-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    SelectModule, InputNumberModule, DatePickerModule, InputMask, DividerModule, TextareaModule,
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

  readonly durationTextControl = this.fb.nonNullable.control('00h00');

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

  // "Dernier champ édité" pour arbitrer les recalculs croisés début/fin/durée.
  private editCounter = 0;
  private readonly lastEdited: Record<'startTime' | 'endTime' | 'duration', number> = {
    startTime: 0, endTime: 0, duration: 0,
  };
  private isProgrammaticUpdate = false;

  constructor() {
    runOnceReady(this.activity, (a) => {
      this.form.patchValue(a);
      this.initDurationFromForm();
    });

    // Sauvegarde optimiste debouncée — abonnement unique (cf. bug du double subscribe imbriqué corrigé).
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
    this.durationTextControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (this.isProgrammaticUpdate) return;
      const minutes = this.parseDuration(value);
      if (minutes === null) return;

      this.lastEdited.duration = ++this.editCounter;
      this.isProgrammaticUpdate = true;
      this.form.controls.duration.setValue(minutes, { emitEvent: false });
      this.isProgrammaticUpdate = false;

      this.recalculateFrom('duration');
    });

    this.form.controls.startTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
      if (this.isProgrammaticUpdate || !start) return;
      this.lastEdited.startTime = ++this.editCounter;
      this.recalculateFrom('startTime');
    });

    this.form.controls.endTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((end) => {
      if (this.isProgrammaticUpdate || !end) return;
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
      this.syncDurationTextFromForm();
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
    this.syncDurationTextFromForm();
  }

  private setEndFromStartAndDuration(start: Date, duration: number): void {
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    this.form.controls.endTime.setValue(end, { emitEvent: false });
  }

  private setStartFromEndAndDuration(end: Date, duration: number): void {
    const start = new Date(end);
    start.setMinutes(start.getMinutes() - duration);
    this.form.controls.startTime.setValue(start, { emitEvent: false });
  }

  private toMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  private parseDuration(value: string): number | null {
    const match = value.match(/^(\d{2})h(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes >= 60) return null;
    return hours * 60 + minutes;
  }

  private syncDurationTextFromForm(): void {
    this.durationTextControl.setValue(this.formatDuration(this.form.controls.duration.value), { emitEvent: false });
  }

  private formatDuration(totalMinutes: number): string {
    const safe = Math.max(0, totalMinutes ?? 0);
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
  }

  private initDurationFromForm(): void {
    const start = this.form.controls.startTime.value;
    const end = this.form.controls.endTime.value;
    const duration = this.form.controls.duration.value;

    if (duration > 0) { this.syncDurationTextFromForm(); return; }
    if (start && end) {
      this.isProgrammaticUpdate = true;
      this.setDurationFromStartAndEnd(start, end);
      this.isProgrammaticUpdate = false;
      return;
    }
    this.syncDurationTextFromForm();
  }
}