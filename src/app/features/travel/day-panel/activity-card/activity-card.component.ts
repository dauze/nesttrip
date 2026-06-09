import { Component, computed, effect, inject, input, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FileUploadModule } from 'primeng/fileupload';
import {
  AutoComplete,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { BadgeModule } from 'primeng/badge';
import { DatePickerModule } from 'primeng/datepicker';
import { InputMask } from 'primeng/inputmask';
import { PanelModule } from 'primeng/panel';
import { BookingStatus } from '@core/enums/booking.status';
import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { FileService } from '@core/services/file.service';
import { GooglePlaceService } from '@core/services/google.places.service';
import {
  ACTIVITY_TYPE_META,
  ACTIVITY_TYPE_OPTIONS,
  BOOKING_STATUS_META,
  BOOKING_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from '@features/travel/day-panel/activity-card/activity.constants';
import { Place } from '@app/core/models/place.dto';
import { tap } from 'rxjs/operators';
import { TravelStore } from '@features/travel/travel.service';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    InputNumberModule,
    DatePickerModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    FileUploadModule,
    BadgeModule,
    PanelModule,
    DurationPipe,
    TextareaModule,
    AutoComplete,
    InputMask,
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  private readonly travelStore = inject(TravelStore);
  private readonly fileService = inject(FileService);
  private readonly googlePlaceService = inject(GooglePlaceService);

  // Remplace les @Input() par des signals
  readonly tripId = input.required<number>();
  readonly dayId = input.required<Date>();
  readonly activityId = input.required<number>();

  readonly activity = computed(() => 
  this.travelStore.getActivity(this.activityId())()
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
    const activity = this.activity();
    if (!activity) return;

    const deadline = activity.booking?.deadline;
    if (!deadline) return false;
    const diff = new Date(deadline).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });
  readonly showDeadline = computed(() => {
    const activity = this.activity();
    if (!activity) return;
    return [BookingStatus.TO_BOOK, BookingStatus.WAITLIST].includes(
      activity.booking?.status ?? BookingStatus.NOT_NEEDED,
    );
  });
  selectedPlace: Pick<Place, 'placeId' | 'name'> | null = null;

  constructor() {
    // Se déclenche quand un nouveau lieu est chargé avec succès
    effect(() => {
      const p = this.googlePlaceService.place();
      if (!p) return;
      const activity = this.activity();
      if (!activity) return;

      this.travelStore.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        title: p.name,
        placeId: p.placeId,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    });
  }

  onChange(): void {
    const activity = this.activity();
    if (!activity) return;
    this.travelStore.updateActivity(this.tripId(), this.dayId(), activity);
  }

  onSearch(event: AutoCompleteCompleteEvent) {
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent) {
    const place = event.value as Partial<Place>;
    this.googlePlaceService.setSelectedId(place.placeId ?? '');
  }

  onFileSelect(event: { files: File[] }): void {
    const activity = this.activity();
    if (!activity) return;
    for (const file of event.files) {
      const path = `trips/${this.tripId()}/${this.dayId().getTime()}/${activity.id}/${file.name}`;
      this.fileService
        .uploadFile(file, path)
        .pipe(
          tap(({ url, name }) => {
            this.travelStore.updateActivity(this.tripId(), this.dayId(), {
              ...activity,
              files: [...(activity.files ?? []), { name, url, path }],
            });
          }),
        )
        .subscribe();
    }
  }

  removeFile(index: number): void {
    const activity = this.activity();
    if (!activity) return;
    const file = activity.files![index];
    this.fileService
      .deleteFile(file.path)
      .pipe(
        tap(() => {
          const files = activity.files ?? [];
          this.travelStore.updateActivity(this.tripId(), this.dayId(), {
            ...activity,
            files: files.filter((_, i) => i !== index),
          });
        }),
      )
      .subscribe();
  }

  get durationDisplay(): string {
    const activity = this.activity();
    if (!activity) return '';
    const duration = activity.duration ?? 0;

    const h = Math.floor(duration / 60);
    const m = duration % 60;

    return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
  }

  onDurationChange(value: string): void {
    const activity = this.activity();
    if (!activity) return;
    const match = value.match(/^(\d{2})h(\d{2})$/);
    if (!match) {
      return;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    activity.duration = hours * 60 + minutes;
    this.onChange();
  }
}
