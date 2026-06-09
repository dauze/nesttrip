import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  shareReplay,
  startWith,
  switchMap
} from 'rxjs';
import { environment } from '../../../environnements/environnement';
import { Place } from '../models/place.dto';

type LoadingState<T> =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'success'; data: T}
  | {status: 'error'};

@Injectable({providedIn: 'root'})
export class GooglePlaceService {
  private http = inject(HttpClient);

  private readonly searchTerm = signal('');
  private readonly selectedId = signal<string>('');

  setSearchTerm(term: string) { this.searchTerm.set(term); }
  setSelectedId(id: string)   { this.selectedId.set(id); }

  // --- Suggestions autocomplete ---

  private readonly placesState$ = toObservable(this.searchTerm).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    filter((q: string) => q.trim().length >= 2),
    map((q: string) => q.trim()),
    switchMap((q: string) =>
      this.http.get<Pick<Place, 'placeId' | 'name'>[]>(`${environment.apiUrl}/etablissements`, {params: {q}}).pipe(
        map((data: any)  => ({status: 'success', data}) as LoadingState<Partial<Place>[]>),
        startWith({status: 'loading'}         as LoadingState<Partial<Place>[]>),
        catchError(() => of({status: 'error'} as LoadingState<Partial<Place>[]>))
      )
    ),
    startWith({status: 'idle'} as LoadingState<Pick<Place, 'placeId' | 'name'>[]>),
    shareReplay({bufferSize: 1, refCount: true})
  );

  readonly placesState = toSignal(this.placesState$,
    {initialValue: {status: 'idle'} as LoadingState<Pick<Place, 'placeId' | 'name'>[]>}
  );

  readonly places  = computed(() => {
    const s = this.placesState();
    return s.status === 'success' ? s.data : [];
  });

  // --- Détail lieu sélectionné ---

  private readonly placeState$ = toObservable(this.selectedId).pipe(
    distinctUntilChanged(),
    filter(id => !!id),
    switchMap(id =>
      this.http.get<Place>(`${environment.apiUrl}/etablissements/${id}`).pipe(
        map(data  => ({status: 'success', data}) as LoadingState<Place>),
        startWith({status: 'loading'}         as LoadingState<Place>),
        catchError(() => of({status: 'error'} as LoadingState<Place>))
      )
    ),
    startWith({status: 'idle'} as LoadingState<Place>),
    shareReplay({bufferSize: 1, refCount: true})
  );

  readonly placeState = toSignal(this.placeState$,
    {initialValue: {status: 'idle'} as LoadingState<Place>}
  );

  readonly place        = computed(() => {
    const s = this.placeState();
    return s.status === 'success' ? s.data : null;
  });
}
