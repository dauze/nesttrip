import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input, effect, viewChild, DestroyRef, OutputEmitterRef } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, tap } from 'rxjs/operators';

import { SelectComponent } from '@app/shared/components/select/select.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { NotesFieldComponent } from '@app/shared/components/notes-field/notes-field.component';
import { PriceFieldComponent } from '@app/shared/components/price-field/price-field.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ChipComponent } from '@app/shared/components/chip/chip.component';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityType } from '@core/enums/activites-type.enum';
import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_OPTIONS, BOOKING_STATUS_META, BOOKING_STATUS_OPTIONS, CURRENCY_OPTIONS } from '../activity.constants';
import { TimePickerDialogComponent } from '@app/shared/components/time-picker-dialog/time-picker-dialog.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { NotesFocusService } from '@app/features/trips/trip-detail/notes-focus.service';
import { LinkListDialogComponent, LinkListDialogData, LinkListDialogResult } from './link-list-dialog/link-list-dialog.component';

@Component({
  selector: 'app-activity-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, NgClass,
    SelectComponent, DatePickerComponent, DividerComponent, NotesFieldComponent, PriceFieldComponent,
    TimePickerDialogComponent, ButtonComponent, ChipComponent,
  ],
  templateUrl: './activity-form.component.html',
  styleUrl: './activity-form.component.scss',
})
export class ActivityFormComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly notesFocusService = inject(NotesFocusService);
  private readonly viewport = inject(ViewportService);

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
    price: this.fb.nonNullable.control<{ amount: number; currency: string }>({ amount: 0, currency: 'EUR' }),
  });

  // Refs template pour le chaînage de saisie guidée mobile (Type → Résa → Début → Fin → Prix), voir startGuidedEntry().
  private readonly typeSelect = viewChild.required<SelectComponent<ActivityType>>('typeSelect');
  private readonly bookingSelect = viewChild.required<SelectComponent<BookingStatus>>('bookingSelect');
  private readonly startTimePickerRef = viewChild.required<TimePickerDialogComponent>('startTimePicker');
  private readonly endTimePickerRef = viewChild.required<TimePickerDialogComponent>('endTimePicker');
  private readonly priceField = viewChild.required<PriceFieldComponent>('priceField');

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
  
  // Contrôle Date dédié pour app-time-picker-dialog (durée), converti en minutes vers form.controls.duration.
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
    // Gestion du changement de la durée via app-time-picker-dialog
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
   * Synchronise le composant de saisie de la durée (app-time-picker-dialog) depuis les minutes du formulaire
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
    // Durée nulle ET pas de début/fin pour la calculer : reste non renseignée
    // (voir ROADMAP.md "UX / Interactions") — `syncDurationTimeControlFromForm`
    // construirait ici un `Date` à 00:00 bien réel, affiché "00:00" au lieu
    // du placeholder "--:--" de `TimePickerDialogComponent`.
    this.durationTimeControl.setValue(null, { emitEvent: false });
  }

  /**
   * Depuis le clic sur l'heure du header (voir ActivityHeaderComponent/
   * ActivityCardComponent, ROADMAP.md "UX / Interactions") : ouvre le
   * tiroir mobile dédié. Sur desktop, le champ Début est déjà visible en
   * ligne une fois la carte dépliée (voir ActivityCardComponent.openStartTime) —
   * rien de plus à faire, même garde que `LogisticDetailsComponent.guidedTime`.
   */
  openStartTimeEditor(): void {
    if (this.viewport.isMobile()) this.startTimePickerRef().openDialog();
  }

  /**
   * Mobile uniquement, déclenché juste après la création d'une activité (voir
   * DayActivityCreationService) : ouvre successivement Type → Résa → Début →
   * Fin, puis focalise Prix. Dès qu'une étape est fermée SANS validation
   * (backdrop/Échap sur un `app-select`, annulation d'un `app-time-picker-dialog`),
   * le chaînage s'arrête net — le reste s'édite manuellement, comme avant
   * cette fonctionnalité.
   */
  startGuidedEntry(): void {
    this.typeSelect().openPanel();
    this.subscribeOnce(this.typeSelect().closed, ({ selected }) => {
      if (!selected) return;

      this.bookingSelect().openPanel();
      this.subscribeOnce(this.bookingSelect().closed, ({ selected }) => {
        if (!selected) return;

        this.startTimePickerRef().openDialog();
        this.subscribeOnce(this.startTimePickerRef().closed, (start) => {
          if (!start) return;

          this.endTimePickerRef().openDialog();
          this.subscribeOnce(this.endTimePickerRef().closed, (end) => {
            if (!end) return;
            this.priceField().openDialog();
          });
        });
      });
    });
  }

  /** S'abonne à un `output()` pour une seule émission puis se désabonne — sécurisé contre la destruction du composant en plein chaînage (voir startGuidedEntry). */
  private subscribeOnce<T>(emitter: OutputEmitterRef<T>, callback: (value: T) => void): void {
    const subscription = emitter.subscribe((value) => {
      subscription.unsubscribe();
      callback(value);
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  // ─── Liste(s) liée(s) (voir ROADMAP.md "UX / Interactions") ────────────────
  // Rien n'est stocké côté activité : recherche inverse des `Item` (Listes)
  // dont `linkedActivityInstanceId` pointe vers CETTE instance (voir
  // TripStore.getLinkedNoteItems) — plusieurs listes peuvent en théorie
  // pointer vers la même activité, d'où un chip par item plutôt qu'un seul.

  readonly linkedListItems = computed(() => this.tripFacade.getLinkedNoteItems(this.tripId(), this.activity().id)());

  /** Tiroir "Lier une liste" — voir LinkListDialogComponent. */
  openLinkListDialog(): void {
    const dialogRef = this.dialogService.open<LinkListDialogResult | undefined, LinkListDialogData>(
      LinkListDialogComponent,
      { data: { tripId: this.tripId() }, panelClass: 'app-wide-dialog-panel', viewContainerRef: this.viewContainerRef },
    );
    dialogRef.closed.subscribe((result) => {
      if (!result) return;
      this.tripFacade.updateItem(this.tripId(), result.itemId, { linkedActivityInstanceId: this.activity().id });
    });
  }

  unlinkList(itemId: string): void {
    this.tripFacade.updateItem(this.tripId(), itemId, { linkedActivityInstanceId: undefined });
  }

  /** Clic sur un chip "liste liée" : navigue vers le tab Listes et scrolle jusqu'à cet item (voir NotesFocusService/NotesComponent). */
  navigateToLinkedList(itemId: string): void {
    this.notesFocusService.requestFocus(itemId);
  }
}