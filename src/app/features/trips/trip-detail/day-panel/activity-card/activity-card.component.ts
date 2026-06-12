import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FileUploadModule } from 'primeng/fileupload';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { BadgeModule } from 'primeng/badge';
import { DatePickerModule } from 'primeng/datepicker';
import { InputMask } from 'primeng/inputmask';
import { PanelModule } from 'primeng/panel';
import { BookingStatus } from '@core/enums/booking.status';
import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { FileService } from '@core/services/file.service';
import { GooglePlaceService } from '@core/services/google.places.service';

import { Place } from '@app/core/models/place.dto';
import { debounceTime, tap } from 'rxjs/operators';
import { ACTIVITY_TYPE_OPTIONS, BOOKING_STATUS_OPTIONS, CURRENCY_OPTIONS, ACTIVITY_TYPE_META, BOOKING_STATUS_META } from './activity.constants';
import { TripStore } from '@app/features/trips/trip-store.service';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, DragDropModule,
    InputTextModule, TextareaModule, SelectModule, InputNumberModule,
    DatePickerModule, TagModule, ButtonModule, TooltipModule,
    FileUploadModule, BadgeModule, PanelModule, DurationPipe,
    AutoComplete, InputMask,
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  private readonly tripStore = inject(TripStore);
  private readonly fileService = inject(FileService);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly fb = inject(FormBuilder);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly activityId = input.required<string>();

  readonly form: FormGroup;

  // Title géré séparément, hors ReactiveForm
  title = '';

  private initialized = false;

  readonly activity = computed(() =>
    this.tripStore.getActivity(this.activityId())()
  );

  readonly activityTypeOptions = ACTIVITY_TYPE_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly activityTypeMeta = ACTIVITY_TYPE_META;
  readonly places = this.googlePlaceService.places;

  readonly bookingMeta = computed(() => {
    const status = this.activity()?.booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });

  readonly isDeadlineSoon = computed(() => {
    const deadline = this.form.get('booking.deadline')?.value;
    if (!deadline) return false;
    const diff = new Date(deadline).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });

  readonly showDeadline = computed(() => {
    const status = this.form.get('booking.status')?.value ?? BookingStatus.NOT_NEEDED;
    return [BookingStatus.TO_BOOK, BookingStatus.WAITLIST].includes(status);
  });

  readonly durationDisplay = computed(() => {
    const duration = this.form.get('duration')?.value ?? 0;
    const h = Math.floor(duration / 60);
    const m = duration % 60;
    return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
  });

  constructor() {
    this.form = this.fb.group({
      type: [''],
      duration: [0],
      notes: [''],
      booking: this.fb.group({
        status: [BookingStatus.NOT_NEEDED],
        deadline: [null],
      }),
      price: this.fb.group({
        amount: [0],
        currency: ['EUR'],
      }),
    });

    // Init depuis le store une seule fois
    effect(() => {
      const a = this.tripStore.getActivity(this.activityId())();
      if (a && !this.initialized) {
        this.initialized = true;
        untracked(() => {
          this.form.patchValue(a, { emitEvent: false });
          this.title = a.title; // title séparé du form
        });
      }
    });

    // Push vers le store à chaque changement du form
    this.form.valueChanges.pipe(debounceTime(300)).subscribe((value) => {
      const activity = this.activity();
      if (!activity) return;
      this.tripStore.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        ...value,
        title: this.title, // on réinjecte le title séparé
        booking: value.booking ?? activity.booking,
        price: value.price ?? activity.price,
      });
    });
  }

  onTitleBlur(): void {
    const activity = this.activity();
    if (!activity) return;
    this.tripStore.updateActivity(this.tripId(), this.dayId(), {
      ...activity,
      title: this.title,
    });
  }

  onSearch(event: AutoCompleteCompleteEvent) {
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent) {
    const place = event.value as Partial<Place>;
    if (!place.placeId) return;

    this.title = place.name ?? '';

    this.googlePlaceService.getPlaceDetail(place.placeId).subscribe((p) => {
      this.title = p.name;
      const activity = this.activity();
      if (!activity) return;
      this.tripStore.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        title: p.name,
        placeId: p.placeId,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    });
  }

  onDurationChange(value: string): void {
    const match = value.match(/^(\d{2})h(\d{2})$/);
    if (!match) return;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    this.form.patchValue({ duration: minutes });
  }

  onFileSelect(event: { files: File[] }): void {
    const activity = this.activity();
    if (!activity) return;
    for (const file of event.files) {
      const path = `trips/${this.tripId()}/${this.dayId().getTime()}/${activity.id}/${file.name}`;
      this.fileService.uploadFile(file, path).pipe(
        tap(({ url, name }) => {
          this.tripStore.updateActivity(this.tripId(), this.dayId(), {
            ...activity,
            files: [...(activity.files ?? []), { name, url, path }],
          });
        }),
      ).subscribe();
    }
  }

  removeFile(index: number): void {
    const activity = this.activity();
    if (!activity) return;
    const file = activity.files![index];
    this.fileService.deleteFile(file.path).pipe(
      tap(() => {
        this.tripStore.updateActivity(this.tripId(), this.dayId(), {
          ...activity,
          files: (activity.files ?? []).filter((_, i) => i !== index),
        });
      }),
    ).subscribe();
  }
}