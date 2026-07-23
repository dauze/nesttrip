import { Component, computed, inject, input, effect } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, tap } from 'rxjs/operators';

import { SelectModule } from 'primeng/select';
import { InputNumberComponent } from '@app/shared/components/input-number/input-number.component';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityType } from '@core/enums/activites-type.enum';
import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_OPTIONS, BOOKING_STATUS_META, BOOKING_STATUS_OPTIONS, CURRENCY_OPTIONS } from '../activity.constants';
import { OverlayAutoCloseDirective } from '@app/shared/directives/overlay-auto-close.directive';
import { ViewportService } from '@core/services/viewport.service';
import { TimePickerDialogComponent } from '@app/shared/components/time-picker-dialog/time-picker-dialog.component';

@Component({
  selector: 'app-activity-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, NgClass,
    SelectModule, InputNumberComponent, DatePickerModule, DividerComponent, TextareaDirective,
    OverlayAutoCloseDirective, TimePickerDialogComponent
  ],
  templateUrl: './activity-form.component.html',
  styleUrl: './activity-form.component.scss',
})
export class ActivityFormComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly fb = inject(FormBuilder);
  protected readonly viewport = inject(ViewportService);

  readonly tripId = input.required<string>();
  /** Toujours renseigné : ce composant n'est monté qu'en contexte jour (jamais dans le pool général). */
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

  private readonly formChanges = toSignal(this.form.valueChanges, { initialValue: null });

  readonly formValue = computed(() => {
    this.activity();    // Dépendance 1 : Se réévalue si l'input change
    this.formChanges(); // Dépendance 2 : Se réévalue si l'utilisateur tape du texte
    return this.form.getRawValue();
  });

  readonly bookingMeta = computed(() => {
    const status = this.formValue().booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });
  
  // Remplacement du contrôle texte par un contrôle Date pour le p-datepicker
  readonly durationTimeControl = this.fb.control<Date | null>(null);

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

  /**
   * true entre le moment où l'utilisateur modifie le form et le moment où le
   * debounce ci-dessous a lu sa valeur pour l'envoyer au store. Évite une
   * course : sans ce garde-fou, l'écho (optimiste) d'une édition n°1 pouvait
   * arriver — et être appliqué via `patchValue` — PENDANT que l'édition n°2
   * était encore en attente de son propre debounce, écrasant silencieusement
   * la valeur en cours de saisie avant même qu'elle soit lue. Symptôme observé :
   * un p-select (type, résa, devise) ne prenait en compte que la toute
   * première sélection, les suivantes étant "avalées". Les champs texte/heure
   * étaient épargnés car l'utilisateur continue de taper au-delà de la fenêtre
   * de debounce, ce qui masque la course.
   */
  private hasUnflushedLocalEdit = false;
  private lastSyncedActivityId: string | undefined;

  constructor() {
    effect(() => {
    const a = this.activity();
    if (!a) return;

    // Une édition locale plus récente n'a pas encore été lue par le debounce
    // ci-dessous : ne pas réappliquer cet écho (potentiellement encore
    // relatif à une édition précédente), sauf si le form vient d'être monté
    // pour une toute autre instance.
    if (this.hasUnflushedLocalEdit && a.id === this.lastSyncedActivityId) return;
    this.lastSyncedActivityId = a.id;

    // On force la date de dayId sur le startTime et endTime reçus si présents
    const patchedActivity = {
      ...a,
      startTime: this.applyDayIdDate(a.startTime ? new Date(a.startTime) : null),
      endTime: this.applyDayIdDate(a.endTime ? new Date(a.endTime) : null),
    };

    // CRUCIAL : { emitEvent: false } évite la boucle infinie avec le debounceTime plus bas
    this.form.patchValue(patchedActivity, { emitEvent: false });
    this.initDurationFromForm();
  });

  // Le reste de votre constructeur (valueChanges.pipe et setupTimeDurationSync) reste inchangé
  this.form.valueChanges.pipe(
    tap(() => { this.hasUnflushedLocalEdit = true; }),
    debounceTime(300),
    takeUntilDestroyed(),
  ).subscribe(() => {
    const activity = this.activity();
    const value = this.form.getRawValue();
    this.hasUnflushedLocalEdit = false;
    this.tripFacade.updateDayActivityInstance(this.tripId(), {
      id: activity.id,
      activityId: activity.activityId,
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