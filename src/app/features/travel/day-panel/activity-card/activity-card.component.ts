import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostBinding,
  input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { FileUploadModule } from 'primeng/fileupload';
import { BadgeModule } from 'primeng/badge';
import { InplaceModule } from 'primeng/inplace';
import { DurationPipe } from '../../../../core/pipes/duration.pipe';
import { ActivityType } from '../../../../core/enums/activites-type.enum';
import { BookingStatus } from '../../../../core/enums/booking.status';
import { DatePickerModule } from 'primeng/datepicker';
import { ActivityService } from '../../../../core/services/activity.service';
import { FileService } from '../../../../core/services/file.service';
import { switchMap } from 'rxjs';
import { Activity } from '../../../../core/models/dto/activity.interface';
import { Day } from '../../../../core/models/dto/trip.interface';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    InputNumberModule,
    DatePickerModule,
    ChipModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    DividerModule,
    FileUploadModule,
    BadgeModule,
    InplaceModule,
    DurationPipe,
  ],
  templateUrl: './activity-card.component.html',
  styleUrls: ['./activity-card.component.scss'],
})
export class ActivityCardComponent  {
  readonly activity = input.required<Activity>();
  readonly tripId = input.required<number>();
  readonly currentDay = input.required<Day>();

  private readonly activityService = inject(ActivityService);
  private readonly fileService = inject(FileService);

  @HostBinding('attr.draggable') draggableAttr = 'true';

  collapsed = false;
  isDragging = false;

  // ── Dropdown options ──────────────────────────────────────────────────────

  activityTypeOptions = Object.values(ActivityType).map((v) => ({
    label: this.labelForType(v),
    value: v,
  }));

  bookingStatusOptions = Object.values(BookingStatus).map((v) => ({
    label: this.labelForStatus(v),
    value: v,
  }));

  currencyOptions = [
    { label: '€ EUR', value: 'EUR' },
    { label: '$ USD', value: 'USD' },
    { label: '£ GBP', value: 'GBP' },
    { label: '¥ JPY', value: 'JPY' },
    { label: 'Fr CHF', value: 'CHF' },
    { label: '$ CAD', value: 'CAD' },
    { label: '$ AUD', value: 'AUD' },
    { label: '₩ KRW', value: 'KRW' },
    { label: '฿ THB', value: 'THB' },
    { label: 'د.إ AED', value: 'AED' },
  ];


  // ── Emit on any change ───────────────────────────────────────────────────

  onChange(): void {
    this.activityService
      .updateActivity(this.tripId(), this.currentDay().id, this.activity(), this.currentDay().activities)
      .subscribe();
  }

  // ── File handling ─────────────────────────────────────────────────────────

 onFileSelect(event: any): void {
    const newFiles = event.files as File[];
    for (const f of newFiles) {
      const path = `trips/${this.tripId()}/${this.currentDay().id.getTime()}/${this.activity().id}/${f.name}`;
      this.fileService.uploadFile(f, path).pipe(
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

  // ── Drag ─────────────────────────────────────────────────────────────────

  onDragStart(event: DragEvent): void {
    this.isDragging = true;
    event.dataTransfer?.setData('text/plain', String(this.activity().id));
  }

  onDragEnd(): void {
    this.isDragging = false;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }

  get bookingStatusSeverity(): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
    const map: Record<BookingStatus, 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast'> = {
      [BookingStatus.BOOKED]: 'success',
      [BookingStatus.TO_BOOK]: 'warn',
      [BookingStatus.CANCELLED]: 'danger',
      [BookingStatus.WAITLIST]: 'info',
      [BookingStatus.NOT_NEEDED]: 'secondary',
    };
    return map[this.activity().booking?.status ?? BookingStatus.NOT_NEEDED];
  }

  get typeIcon(): string {
    const map: Record<ActivityType, string> = {
      [ActivityType.REPAS]: 'pi-prime pi-star',
      [ActivityType.TRANSPORT]: 'pi pi-car',
      [ActivityType.HEBERGEMENT]: 'pi pi-home',
      [ActivityType.VISITE]: 'pi pi-map-marker',
      [ActivityType.ACTIVITE]: 'pi pi-bolt',
      [ActivityType.SHOPPING]: 'pi pi-shopping-bag',
      [ActivityType.DETENTE]: 'pi pi-heart',
      [ActivityType.EVENEMENT]: 'pi pi-calendar',
      [ActivityType.NATURE]: 'pi pi-sun',
      [ActivityType.SOINS]: 'pi pi-plus-circle',
    };
    return map[this.activity().type] ?? 'pi pi-tag';
  }

  get typeColor(): string {
    const map: Record<ActivityType, string> = {
      [ActivityType.REPAS]: '#f97316',
      [ActivityType.TRANSPORT]: '#6366f1',
      [ActivityType.HEBERGEMENT]: '#14b8a6',
      [ActivityType.VISITE]: '#8b5cf6',
      [ActivityType.ACTIVITE]: '#ec4899',
      [ActivityType.SHOPPING]: '#f59e0b',
      [ActivityType.DETENTE]: '#10b981',
      [ActivityType.EVENEMENT]: '#3b82f6',
      [ActivityType.NATURE]: '#22c55e',
      [ActivityType.SOINS]: '#06b6d4',
    };
    return map[this.activity().type] ?? '#64748b';
  }

  labelForType(type: ActivityType): string {
    const map: Record<ActivityType, string> = {
      [ActivityType.REPAS]: '🍽️ Repas',
      [ActivityType.TRANSPORT]: '🚗 Transport',
      [ActivityType.HEBERGEMENT]: '🏠 Hébergement',
      [ActivityType.VISITE]: '📍 Visite',
      [ActivityType.ACTIVITE]: '⚡ Activité',
      [ActivityType.SHOPPING]: '🛍️ Shopping',
      [ActivityType.DETENTE]: '💆 Détente',
      [ActivityType.EVENEMENT]: '🎉 Événement',
      [ActivityType.NATURE]: '🌿 Nature',
      [ActivityType.SOINS]: '💊 Soins',
    };
    return map[type] ?? type;
  }

  labelForStatus(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      [BookingStatus.TO_BOOK]: '📋 À réserver',
      [BookingStatus.BOOKED]: '✅ Réservé',
      [BookingStatus.NOT_NEEDED]: '— Sans réservation',
      [BookingStatus.WAITLIST]: '⏳ Liste d\'attente',
      [BookingStatus.CANCELLED]: '❌ Annulé',
    };
    return map[status] ?? status;
  }

  get hasBookingDeadline(): boolean {
    return !!this.activity().booking?.deadline;
  }

  get isDeadlineSoon(): boolean {
    if (!this.activity().booking?.deadline) return false;
    const diff = new Date(this.activity().booking?.deadline ?? 0).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }

  ActivityType = ActivityType;
  BookingStatus = BookingStatus;
}