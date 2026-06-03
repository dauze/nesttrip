import { Component, computed, effect, inject, input } from '@angular/core';
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
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { BadgeModule } from 'primeng/badge';
import { DatePickerModule } from 'primeng/datepicker';
import { InputMask } from 'primeng/inputmask';
import { PanelModule } from 'primeng/panel';
import { ProgressSpinner  } from 'primeng/progressspinner';
import { BookingStatus } from '@core/enums/booking.status';
import { Activity } from '@features/travel/day-panel/activity.model';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';
import { Day } from '@features/travel/travel.model';
import { ActivityService } from '@features/travel/day-panel/activity.service';
import { FileService } from '@core/services/file.service';
import {GooglePlaceService} from '@core/services/google.places.service';
import {
  ACTIVITY_TYPE_META,
  ACTIVITY_TYPE_OPTIONS,
  BOOKING_STATUS_META,
  BOOKING_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from '@features/travel/day-panel/activity-card/activity.constants';
import { filter, first, switchMap } from 'rxjs';
import {Place} from '@app/core/models/place.dto';

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
    ProgressSpinner,
    InputMask,
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  readonly activity = input.required<Activity>();
  readonly tripId = input.required<number>();
  readonly currentDay = input.required<Day>();

  private readonly activityService = inject(ActivityService);
  private readonly fileService = inject(FileService);
  private readonly googlePlaceService = inject(GooglePlaceService);

  readonly activityTypeOptions = ACTIVITY_TYPE_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;

  readonly activityTypeMeta = ACTIVITY_TYPE_META;

  readonly places        = this.googlePlaceService.places;

  readonly bookingMeta = computed(() => {
    const status = this.activity()?.booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });
  readonly isDeadlineSoon = computed(() => {
    const deadline = this.activity().booking?.deadline;
    if (!deadline) return false;
    const diff = new Date(deadline).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });
  readonly showDeadline = computed(() =>
    [BookingStatus.TO_BOOK, BookingStatus.WAITLIST].includes(
      this.activity().booking?.status ?? BookingStatus.NOT_NEEDED,
    ),
  );
  selectedPlace: Pick<Place, 'placeId' | 'name'> | null = null;


  constructor() {
    // Se déclenche quand un nouveau lieu est chargé avec succès
    effect(() => {
      const p = this.googlePlaceService.place();
      if (!p) return;

      Object.assign(this.activity(), {
        title:   p.name,
        placeId: p.placeId,
        lat:     p.latitude,
        lng:     p.longitude,
      });
      this.onChange();
    });
  }

  onChange(): void {
    this.activityService
      .updateActivity(
        this.tripId(),
        this.currentDay().id,
        this.activity(),
        this.currentDay().activities,
      )
      .subscribe();
  }

  onSearch(event: AutoCompleteCompleteEvent) {
    this.googlePlaceService.setSearchTerm(event.query  ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent) {
    const place = event.value as Partial<Place>;
    this.googlePlaceService.setSelectedId(place.placeId ?? '');
    // C'est tout — l'effect s'occupe du reste
  }

  onFileSelect(event: { files: File[] }): void {
    for (const file of event.files) {
      const path = `trips/${this.tripId()}/${this.currentDay().id.getTime()}/${this.activity().id}/${file.name}`;
      this.fileService
        .uploadFile(file, path)
        .pipe(
          switchMap(({ url, name }) => {
            this.activity().files!.push({ name, url, path });
            return this.activityService.updateActivity(
              this.tripId(),
              this.currentDay().id,
              this.activity(),
              this.currentDay().activities,
            );
          }),
        )
        .subscribe();
    }
  }

  removeFile(index: number): void {
    const file = this.activity().files![index];
    this.fileService
      .deleteFile(file.path)
      .pipe(
        switchMap(() => {
          this.activity().files!.splice(index, 1);
          return this.activityService.updateActivity(
            this.tripId(),
            this.currentDay().id,
            this.activity(),
            this.currentDay().activities,
          );
        }),
      )
      .subscribe();
  }

  get durationDisplay(): string {
    const duration = this.activity().duration ?? 0;

    const h = Math.floor(duration / 60);
    const m = duration % 60;

    return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
  }

  onDurationChange(value: string): void {
    const match = value.match(/^(\d{2})h(\d{2})$/);

    if (!match) {
      return;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    this.activity().duration = hours * 60 + minutes;
    this.onChange();
  }
}
