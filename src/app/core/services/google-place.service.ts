import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError, debounceTime, distinctUntilChanged, filter,
  map, Observable, of, shareReplay, startWith, switchMap
} from 'rxjs';
import { environment } from '@environments/environment';
import {
  LoadingState, PlaceSummary, PlaceDetails, PlacePhotos
} from '../models/place.dto';

@Injectable({ providedIn: 'root' })
export class GooglePlaceService {
  private http = inject(HttpClient);

  // --- Autocomplete ---

  private readonly searchTerm = signal('');
  setSearchTerm(term: string) { this.searchTerm.set(term); }

  private readonly searchCache = new Map<string, Observable<PlaceSummary[]>>();

  private searchPlaces$(q: string): Observable<PlaceSummary[]> {
    let cached = this.searchCache.get(q);
    if (!cached) {
      cached = this.http
        .get<PlaceSummary[]>(`${environment.apiUrl}/etablissements`, { params: { q } })
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.searchCache.set(q, cached);
    }
    return cached;
  }

  private readonly placesState$ = toObservable(this.searchTerm).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    filter((q) => q.trim().length >= 2),
    map((q) => q.trim()),
    switchMap((q) =>
      this.searchPlaces$(q).pipe(
        map((data) => ({ status: 'success', data }) as LoadingState<PlaceSummary[]>),
        startWith({ status: 'loading' } as LoadingState<PlaceSummary[]>),
        catchError(() => of({ status: 'error' } as LoadingState<PlaceSummary[]>))
      )
    ),
    startWith({ status: 'idle' } as LoadingState<PlaceSummary[]>),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly placesState = toSignal(this.placesState$, {
    initialValue: { status: 'idle' } as LoadingState<PlaceSummary[]>,
  });

  readonly places = computed(() => {
    const s = this.placesState();
    return s.status === 'success' ? s.data : [];
  });

  readonly searching = computed(() => this.placesState().status === 'loading');

  // --- Détail : Regroupé en un seul appel ---

  private readonly detailsCache = new Map<string, Observable<LoadingState<PlaceDetails>>>();
  private readonly photosCache  = new Map<string, Observable<LoadingState<PlacePhotos>>>();

  getPlaceDetails$(placeId: string): Observable<LoadingState<PlaceDetails>> {
    return this.memoize(this.detailsCache, placeId,
      this.http.get<PlaceDetails>(`${environment.apiUrl}/etablissements/${placeId}/details`));
  }

  getPlacePhotos$(placeId: string): Observable<LoadingState<PlacePhotos>> {
    return this.memoize(this.photosCache, placeId,
      this.http.get<PlacePhotos>(`${environment.apiUrl}/etablissements/${placeId}/photos`));
  }

  private memoize<T>(
    cache: Map<string, Observable<LoadingState<T>>>,
    key: string,
    source$: Observable<T>
  ): Observable<LoadingState<T>> {
    let entry = cache.get(key);
    if (!entry) {
      entry = source$.pipe(
        map((data) => ({ status: 'success', data }) as LoadingState<T>),
        startWith({ status: 'loading' } as LoadingState<T>),
        catchError(() => of({ status: 'error' } as LoadingState<T>)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      cache.set(key, entry);
    }
    return entry;
  }
}