import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  Signal,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';

import { ChipModule } from 'primeng/chip';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { GooglePhotoService } from '@app/core/services/google-photo.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivityFile } from './activity.model';
import { ActivityType } from '@app/core/enums/activites-type.enum';
import { TripFacade } from '@app/features/trips/trip-facade.service';

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
export class ActivityCardComponent implements OnInit{
  private readonly tripFacade = inject(TripFacade);
  private readonly fileService = inject(FileService);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly googlePhotoService = inject(GooglePhotoService);
  private readonly fb = inject(FormBuilder);

  @ViewChild('cardContainer')
  cardContainer!: ElementRef<HTMLElement>;

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly activityId = input.required<string>();

  readonly deleteRequest = output<void>();
  readonly aiEnrichRequest = output<void>();

  readonly durationTextControl = this.fb.nonNullable.control('00h00');

  private editCounter = 0;
  private isProgrammaticUpdate = false;

  private readonly lastEdited: Record<'startTime' | 'endTime' | 'duration', number> = {
    startTime: 0,
    endTime: 0,
    duration: 0,
  };

  
  ngOnInit(): void {
    this.setupTimeDurationSync();

    // Important : synchroniser l'affichage initial
    this.syncDurationTextFromForm();
  }


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

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  }) as Signal<ReturnType<typeof this.form.getRawValue>>;

  /** Title managed separately to avoid ngModel/ReactiveForm conflict with p-autoComplete */
  title = '';
  collapsed = true;

  /** Files currently uploading (tracked by filename for spinner display) */
  readonly uploadingFiles = signal<Set<string>>(new Set());

  /**
   * Lazy-loaded Google data (photos + reviews + openingHours).
   * Fetched on first panel expand. NOT stored in Firestore (Google TOS §3.2.3b).
   */
  readonly searching = signal(false);
  readonly lazyGoogleData = signal<Place | null>(null);
  private lazyGoogleData$ = toObservable(this.lazyGoogleData);
  readonly googleDataLoading = signal(false);
  private googleDataLoaded = false;

  private initialized = false;

  readonly activity = computed(() => this.tripFacade.getActivity(this.activityId())());
  readonly activityTypeOptions = ACTIVITY_TYPE_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly activityTypeMeta = ACTIVITY_TYPE_META;
  readonly places = this.googlePlaceService.places;
  private readonly photoUrlCache = new Map<string, Observable<string>>();

  currentPhotoIndex = 0;

  prevPhoto(): void { this.currentPhotoIndex--; }
  nextPhoto(): void { this.currentPhotoIndex++; }

  readonly showDeadline = computed(() => {
    const status = this.formValue().booking.status;
    return [BookingStatus.TO_BOOK, BookingStatus.WAITLIST].includes(status);
  });

  onTimeChanged(): void {
  const start = this.form.controls.startTime.value;
  const end = this.form.controls.endTime.value;

  if (!start || !end) {
    return;
  }

  let diffMinutes =
    (end.getHours() * 60 + end.getMinutes()) -
    (start.getHours() * 60 + start.getMinutes());

  // Passage de minuit
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }
 this.form.patchValue({ duration: diffMinutes });
}

  readonly isDeadlineSoon = computed(() => {
    const deadline = this.formValue()?.booking.deadline;
    if (!deadline) return false;
    const diff = new Date(deadline).getTime() - Date.now();
    return diff < 7 * 24 * 60 * 60 * 1000;
  });

  readonly bookingMeta = computed(() => {
    const status = this.activity()?.booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
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
    const address = this.lazyGoogleData()?.address;
    if (!address?.length) return null;
    const name = this.lazyGoogleData()?.name;
    if (!name?.length) return null;
    const query = encodeURIComponent(address || name);
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${this.activity().placeId}`;
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
    effect(() => {
      const a = this.tripFacade.getActivity(this.activityId())();
      if (a && !this.initialized) {
        this.initialized = true;
        untracked(() => {
          this.form.patchValue(a);
          this.title = a.title;
          this.afterActivityLoaded();
        });
      }
    });

    this.form.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      const activity = this.activity();
      if (!activity) return;
      this.form.valueChanges.pipe(debounceTime(300)).subscribe((value) => {
          const activity = this.activity();
          if (!activity) return;
          this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
            ...activity,
            ...value,
            title: this.title,
            startTime: value.startTime ?? undefined ,
            endTime: value.endTime ?? undefined ,
            booking: { ...activity.booking, ...value.booking, deadline: value.booking?.deadline ?? undefined },
            price: { ...activity.price, ...value.price },
          });
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

  openAndScroll() {
    const wasCollapsed = this.collapsed;

    if (wasCollapsed) {
      this.collapsed = false;

      // attendre le rendu
      setTimeout(() => {
        this.scrollToMe();
      }, 300); // ajuster selon l'animation PrimeNG
    } else {
      this.scrollToMe();
    }
  }

  onTitleBlur(): void {
    const activity = this.activity();
    if (!activity) return;
    if (activity.title === this.title) {
        return;
      }
    this.currentPhotoIndex = 0;
    this.lazyGoogleData.set(null);
    this.googleDataLoaded = false;
    this.photoUrlCache.clear();
    this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
      ...activity,
      title: this.title,
      placeId: '',
      address: '',
      latitude: 0,
      longitude: 0,
      rating: 0,
      reviewCount: 0,
      openingHours: [],
      phone: '',
      website: '',
      priceLevel: 0,
    });
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.searching.set(true);
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
        setTimeout(() => {
        this.title = p.name;
      });
      const activity = this.activity();
      if (!activity) return;

      this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
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

  onDurationEdited(): void {
    const value = this.durationTextControl.value;
    const minutes = this.parseDuration(value);

    if (minutes === null) {
      this.syncDurationTextFromForm();
      return;
    }

    this.lastEdited.duration = ++this.editCounter;

    this.form.controls.duration.setValue(minutes, { emitEvent: false });

    this.recalculateFrom('duration');
  }

  onTimeEdited(control: 'startTime' | 'endTime'): void {
    const value = this.form.controls[control].value;

    if (!value) {
      return;
    }

    this.lastEdited[control] = ++this.editCounter;

    this.recalculateFrom(control);
  }

private recalculateFrom(changed: 'startTime' | 'endTime' | 'duration'): void {
  const start = this.form.controls.startTime.value;
  const end = this.form.controls.endTime.value;
  const duration = this.form.controls.duration.value;

  this.isProgrammaticUpdate = true;

  if (changed === 'duration') {
    if (start) {
      this.setEndFromStartAndDuration(start, duration);
    } else if (end) {
      this.setStartFromEndAndDuration(end, duration);
    }

    this.syncDurationTextFromForm();
    this.isProgrammaticUpdate = false;
    return;
  }

  if (changed === 'startTime') {
    if (!start) {
      this.isProgrammaticUpdate = false;
      return;
    }

    const shouldKeepEnd =
      !!end &&
      this.lastEdited.endTime >= this.lastEdited.duration;

    if (shouldKeepEnd) {
      this.setDurationFromStartAndEnd(start, end);
    } else {
      this.setEndFromStartAndDuration(start, duration);
    }

    this.isProgrammaticUpdate = false;
    return;
  }

  if (changed === 'endTime') {
    if (!end) {
      this.isProgrammaticUpdate = false;
      return;
    }

    const shouldKeepStart =
      !!start &&
      this.lastEdited.startTime >= this.lastEdited.duration;

    if (shouldKeepStart) {
      this.setDurationFromStartAndEnd(start, end);
    } else {
      this.setStartFromEndAndDuration(end, duration);
    }

    this.isProgrammaticUpdate = false;
  }
}

  onFileSelect(event: { files: File[] }): void {
    const activity = this.activity();
    if (!activity) return;

    for (const file of event.files) {
      const path = `trips/${this.tripId()}/${this.dayId().getTime()}/${activity.id}/${file.name}`;
      this.uploadingFiles.update((s) => new Set(s).add(file.name));

      this.fileService.uploadFile(file, path).pipe(
        tap(({ url, name }) => {
          this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
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
        this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
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

  openFile(file: ActivityFile, event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.p-chip-remove-icon')) {
      return; // clic sur la croix, on ignore
    }
    window.open(file.url, '_blank', 'noopener');
  }

  private scrollToMe() {
    this.cardContainer.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  private updateEndTimeFromDuration(): void {
    const start = this.form.controls.startTime.value;
    const duration = this.form.controls.duration.value;

    if (!start) {
      return;
    }

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    this.form.patchValue({ endTime: end });
  }

  private setDurationFromStartAndEnd(start: Date, end: Date): void {
  let diffMinutes =
    this.toMinutes(end) - this.toMinutes(start);

  // Passage de minuit
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  this.form.controls.duration.setValue(diffMinutes, { emitEvent: false });
  this.syncDurationTextFromForm();
  }

  private setEndFromStartAndDuration(start: Date, duration: number): void {
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    this.form.controls.endTime.setValue(end, { emitEvent: false });
  }

  private parseDuration(value: string): number | null {
  const match = value.match(/^(\d{2})h(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (minutes >= 60) {
    return null;
  }

  return hours * 60 + minutes;
}

private syncDurationTextFromForm(): void {
  const duration = this.form.controls.duration.value;
  const text = this.formatDuration(duration);

  this.durationTextControl.setValue(text, { emitEvent: false });
}

private formatDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, totalMinutes ?? 0);

  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${hours.toString().padStart(2, '0')}h${minutes
    .toString()
    .padStart(2, '0')}`;
}


private setStartFromEndAndDuration(end: Date, duration: number): void {
  const start = new Date(end);
  start.setMinutes(start.getMinutes() - duration);

  this.form.controls.startTime.setValue(start, { emitEvent: false });
}

private toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}


private setupTimeDurationSync(): void {
  this.durationTextControl.valueChanges.subscribe(value => {
    if (this.isProgrammaticUpdate) {
      return;
    }

    const minutes = this.parseDuration(value);

    if (minutes === null) {
      return;
    }

    this.lastEdited.duration = ++this.editCounter;

    this.isProgrammaticUpdate = true;
    this.form.controls.duration.setValue(minutes, { emitEvent: false });
    this.isProgrammaticUpdate = false;

    this.recalculateFrom('duration');
  });

  this.form.controls.startTime.valueChanges.subscribe(start => {
    if (this.isProgrammaticUpdate || !start) {
      return;
    }

    this.lastEdited.startTime = ++this.editCounter;
    this.recalculateFrom('startTime');
  });

  this.form.controls.endTime.valueChanges.subscribe(end => {
    if (this.isProgrammaticUpdate || !end) {
      return;
    }

    this.lastEdited.endTime = ++this.editCounter;
    this.recalculateFrom('endTime');
  });
}

private afterActivityLoaded(): void {
  const start = this.form.controls.startTime.value;
  const end = this.form.controls.endTime.value;
  const duration = this.form.controls.duration.value;

  if (duration > 0) {
    this.syncDurationTextFromForm();
    return;
  }

  if (start && end) {
    this.isProgrammaticUpdate = true;
    this.setDurationFromStartAndEnd(start, end);
    this.isProgrammaticUpdate = false;
    return;
  }

  this.syncDurationTextFromForm();
}
}


