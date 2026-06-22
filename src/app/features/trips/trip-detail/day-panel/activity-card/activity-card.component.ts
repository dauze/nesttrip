import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ChipModule } from 'primeng/chip';
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
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { GalleriaModule } from 'primeng/galleria';

import { combineLatest, map, switchMap, of,shareReplay,catchError, Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { BookingStatus } from '@core/enums/booking.status';
import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { FileService } from '@core/services/file.service';
import { GooglePlaceService } from '@core/services/google.places.service';
import { Place } from '@app/core/models/place.dto';
import { debounceTime, tap } from 'rxjs/operators';
import {
  ACTIVITY_TYPE_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
  ACTIVITY_TYPE_META,
  BOOKING_STATUS_META,
} from './activity.constants';
import { TripStore } from '@app/features/trips/trip-store.service';
import { GooglePhotoService } from '@app/core/services/google-photo.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivityFile } from './activity.model';

/** Max photos shown in carousel — change freely */
const MAX_PHOTOS = 6;

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    DividerModule,
    ProgressSpinnerModule,
    GalleriaModule,
    DurationPipe,
    AutoComplete,
    InputMask,
    ChipModule
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  private readonly tripStore = inject(TripStore);
  private readonly fileService = inject(FileService);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly googlePhotoService = inject(GooglePhotoService);
  private readonly fb = inject(FormBuilder);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly activityId = input.required<string>();

  readonly deleteRequest = output<void>();
  readonly aiEnrichRequest = output<void>();

  readonly form: FormGroup;

  /** Title managed separately to avoid ngModel/ReactiveForm conflict with p-autoComplete */
  title = '';

  /** Files currently uploading (tracked by filename for spinner display) */
  readonly uploadingFiles = signal<Set<string>>(new Set());

  /**
   * Lazy-loaded Google data (photos + reviews + openingHours).
   * Fetched on first panel expand. NOT stored in Firestore (Google TOS §3.2.3b).
   */
  readonly lazyGoogleData = signal<Place | null>(null);
  private lazyGoogleData$ = toObservable(this.lazyGoogleData);
  readonly googleDataLoading = signal(false);
  private googleDataLoaded = false;

  private initialized = false;

  readonly activity = computed(() => this.tripStore.getActivity(this.activityId())());
  readonly activityTypeOptions = ACTIVITY_TYPE_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly activityTypeMeta = ACTIVITY_TYPE_META;
  readonly places = this.googlePlaceService.places;
  private readonly photoUrlCache = new Map<string, Observable<string>>();

  currentPhotoIndex = 0;

  prevPhoto(): void { this.currentPhotoIndex--; }
  nextPhoto(): void { this.currentPhotoIndex++; }

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

  /** Gallery images built from lazy photo refs, proxied through Firebase Function */
  private readonly galleryImages$ = this.lazyGoogleData$.pipe(
    map(data => data?.photos ?? []),
    map(photos => photos.slice(0, MAX_PHOTOS)),
  
    switchMap((photos) => {
      if (!photos.length) return of([]);
  
      return combineLatest(
        photos.map((ref) =>
          this.getPhotoUrl$(ref, 800).pipe(
            map(url => ({
              itemImageSrc: url,
              alt: this.activity()?.title ?? ''
            }))
          )
        )
      );
    }),
    map(images =>
      images.map(img => ({
        itemImageSrc: img.itemImageSrc,
        alt: img.alt
        // thumbnailImageSrc supprimé
      }))
    ),
    shareReplay(1)
  );
  
  readonly galleryImages = toSignal(this.galleryImages$, { initialValue: [] });
  readonly hasPlaceId = computed(() => !!this.activity()?.placeId);

  readonly mapsUrl = computed(() => {
    const placeId = this.activity()?.placeId;
    return placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null;
  });

  /**
   * Open/closed status from lazy openingHours, relative to dayId date + current time.
   * Google format (fr): "lundi: 11:00 – 02:00"
   */
  readonly isOpenNow = computed(() => {
    const hours = this.lazyGoogleData()?.openingHours;
    if (!hours?.length) return null;

    const day = this.dayId();
    const now = new Date();
    const checkTime = new Date(day);
    checkTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const todayName = dayNames[checkTime.getDay()];
    const todayLine = hours.find((h) => h.toLowerCase().startsWith(todayName));
    if (!todayLine) return false;
    if (todayLine.toLowerCase().includes('fermé')) return false;

    const ranges = [...todayLine.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)];
    const hm = checkTime.getHours() * 60 + checkTime.getMinutes();

    return ranges.some(([, sh, sm, eh, em]) => {
      const start = +sh * 60 + +sm;
      let end = +eh * 60 + +em;
      if (end < start) end += 24 * 60; // overnight hours
      return hm >= start && hm <= end;
    });
  });

  readonly todayDayName = computed(() => {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return dayNames[this.dayId().getDay()];
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

    effect(() => {
      const a = this.tripStore.getActivity(this.activityId())();
      if (a && !this.initialized) {
        this.initialized = true;
        untracked(() => {
          this.form.patchValue(a, { emitEvent: false });
          this.title = a.title;
        });
      }
    });

    this.form.valueChanges.pipe(debounceTime(300)).subscribe((value) => {
      const activity = this.activity();
      if (!activity) return;
      this.tripStore.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        ...value,
        title: this.title,
        booking: value.booking ?? activity.booking,
        price: value.price ?? activity.price,
      });
    });

    effect(() => {
      const placeId = this.activity()?.placeId;
      if (!placeId || this.googleDataLoaded || this.googleDataLoading()) return;
  
      this.googleDataLoading.set(true);
      this.googlePlaceService.getPlaceDetail(placeId).subscribe({
        next: (place) => {
          this.lazyGoogleData.set(place);
          this.googleDataLoaded = true;
          this.googleDataLoading.set(false);
        },
        error: () => this.googleDataLoading.set(false),
      });
    });
  }

  onTitleBlur(): void {
     this.currentPhotoIndex = 0;
    const activity = this.activity();
    if (!activity) return;
    this.tripStore.updateActivity(this.tripId(), this.dayId(), {
      ...activity,
      title: this.title,
    });
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    const place = event.value as Partial<Place>;
    if (!place.placeId) return;

    this.title = place.name ?? '';
    this.lazyGoogleData.set(null);
    this.googleDataLoaded = false;
    this.photoUrlCache.clear();
    this.googlePlaceService.getPlaceDetail(place.placeId).subscribe((p) => {
      this.title = p.name;
      const activity = this.activity();
      if (!activity) return;

      this.tripStore.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        title: p.name,
        placeId: p.placeId ?? '',
        address: p.address ?? '',
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        openingHours: p.openingHours ?? [],
        phone: p.phone ?? '',
        website: p.website ?? '',
        priceLevel: p.priceLevel ?? 0,
      });

      // Cache locally for this session only
      this.lazyGoogleData.set(p);
      this.googleDataLoaded = true;
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
      this.uploadingFiles.update((s) => new Set(s).add(file.name));

      this.fileService.uploadFile(file, path).pipe(
        tap(({ url, name }) => {
          this.tripStore.updateActivity(this.tripId(), this.dayId(), {
            ...activity,
            files: [...(activity.files ?? []), { name, url, path }],
          });
        }),
      ).subscribe({
        complete: () => this.uploadingFiles.update((s) => { const n = new Set(s); n.delete(file.name); return n; }),
        error:    () => this.uploadingFiles.update((s) => { const n = new Set(s); n.delete(file.name); return n; }),
      });
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

  onDeleteClick(): void { this.deleteRequest.emit(); }
  onAiEnrichClick(): void { this.aiEnrichRequest.emit(); }

  getPhotoUrl$(ref: string, maxWidth = 800): Observable<string> {
    const key = `${ref}__${maxWidth}`;
    if (!this.photoUrlCache.has(key)) {
      this.photoUrlCache.set(
        key,
        this.googlePhotoService.getPhoto$(ref, maxWidth).pipe(
          catchError(() => of('')),
          shareReplay(1)
        )
      );
    }
    return this.photoUrlCache.get(key)!;
  }

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: 'pi-file-pdf',
      jpg: 'pi-image', jpeg: 'pi-image', png: 'pi-image', webp: 'pi-image',
      doc: 'pi-file-word', docx: 'pi-file-word',
    };
    return `pi ${map[ext] ?? 'pi-file'}`;
  }

  openFile(file: ActivityFile) {
    window.open(file.url, '_blank', 'noopener');
  }
}