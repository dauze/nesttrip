import { Component, input, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { InputTextModule }   from 'primeng/inputtext';
import { TextareaModule }    from 'primeng/textarea';
import { SelectModule }      from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule }         from 'primeng/tag';
import { ButtonModule }      from 'primeng/button';
import { TooltipModule }     from 'primeng/tooltip';
import { FileUploadModule }  from 'primeng/fileupload';
import { BadgeModule }       from 'primeng/badge';
import { DatePickerModule }  from 'primeng/datepicker';
import { PanelModule }       from 'primeng/panel';
import { ActivityService }   from '../../../../core/services/activity.service';
import { FileService }       from '../../../../core/services/file.service';
import { Activity }          from '../../../../core/models/dto/activity.interface';
import { Day }               from '../../../../core/models/dto/trip.interface';
import { BookingStatus }     from '../../../../core/enums/booking.status';
import {
  ACTIVITY_TYPE_META,
  BOOKING_STATUS_META,
  ACTIVITY_TYPE_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from '../../../../core/constants/activity.constants';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DragDropModule,
    InputTextModule, TextareaModule, SelectModule, InputNumberModule,
    DatePickerModule, TagModule, ButtonModule, TooltipModule,
    FileUploadModule, BadgeModule, PanelModule
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  readonly activity   = input.required<Activity>();
  readonly tripId     = input.required<number>();
  readonly currentDay = input.required<Day>();

  private readonly activityService = inject(ActivityService);
  private readonly fileService     = inject(FileService);

  readonly activityTypeOptions  = ACTIVITY_TYPE_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;
  readonly currencyOptions      = CURRENCY_OPTIONS;

  readonly BookingStatus = BookingStatus;

  readonly typeMeta    = computed(() => ACTIVITY_TYPE_META[this.activity().type]);
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
      this.activity().booking?.status ?? BookingStatus.NOT_NEEDED
    )
  );

  onChange(): void {
    this.activityService
      .updateActivity(this.tripId(), this.currentDay().id, this.activity(), this.currentDay().activities)
      .subscribe();
  }

  onFileSelect(event: { files: File[] }): void {
    for (const file of event.files) {
      const path = `trips/${this.tripId()}/${this.currentDay().id.getTime()}/${this.activity().id}/${file.name}`;
      this.fileService.uploadFile(file, path).pipe(
        switchMap(({ url, name }) => {
          this.activity().files!.push({ name, url, path });
          return this.activityService.updateActivity(
            this.tripId(), this.currentDay().id, this.activity(), this.currentDay().activities
          );
        })
      ).subscribe();
    }
  }

  removeFile(index: number): void {
    const file = this.activity().files![index];
    this.fileService.deleteFile(file.path).pipe(
      switchMap(() => {
        this.activity().files!.splice(index, 1);
        return this.activityService.updateActivity(
          this.tripId(), this.currentDay().id, this.activity(), this.currentDay().activities
        );
      })
    ).subscribe();
  }
}