import {Injectable, inject, signal, Signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {toSignal, toObservable} from '@angular/core/rxjs-interop';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  filter,
  shareReplay,
  map
} from 'rxjs';
import {Place} from '../models/place.dto';

@Injectable({providedIn: 'root'})
export class GooglePlaceService {
  private http = inject(HttpClient);

  private readonly searchTerm: Signal<string> = signal('');
  private readonly selectedId: Signal<string> = signal<string>(null);


  setSearchTerm(term: string) {
    this.searchTerm.set(term);
  }

  setSelectedId(id: string) {
    this.selectedId.set(id);
  }


  readonly places = toSignal(
    toObservable(this.searchTerm).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => !!q && q.trim().length >= 2),
      map(q => q.trim()),
      switchMap(q =>
        this.http
          .get<Place[]>('/api/etablissements', {params: {q}})
          .pipe(
            catchError(() => of([]))
          )
      ),
      shareReplay({bufferSize: 1, refCount: true})
    ),
    {initialValue: []}
  );

  readonly place = toSignal(
    toObservable(this.selectedId).pipe(
      distinctUntilChanged(),
      filter(q => !!q),
      map(q => q.trim()),
      switchMap(id => this.http
        .get<Place>(`/api/etablissements/${id}`)
        .pipe(
          catchError(() => of(null))
        )
      ),
      shareReplay({bufferSize: 1, refCount: true})
    ),
    {initialValue: null}
  );
}
