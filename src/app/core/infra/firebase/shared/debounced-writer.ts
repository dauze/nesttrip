// src/app/core/infra/firebase/shared/debounced-writer.ts
import { signal } from "@angular/core";
import { Subject, debounceTime, tap, switchMap, finalize, EMPTY, from, catchError, timer } from "rxjs";

// base-persistence.service.ts
export abstract class DebounceWriter<K, T extends { key: K }> {
  protected abstract write(updates: T[]): Promise<unknown>;

  readonly syncing = signal(false);
  /** `true` dès qu'un flush échoue (retry programmé), remis à `false` au flush réussi suivant — voir l'indicateur de sauvegarde (SaveStatusBarComponent) qui agrège ce signal sur tous les writers. */
  readonly hasError = signal(false);
  private readonly pending = new Map<K, T>();
  private readonly trigger$ = new Subject<void>();

  private static readonly RETRY_DELAY_MS = 3000;

  constructor() {
    this.trigger$.pipe(
      debounceTime(300),
      tap(() => this.syncing.set(true)),
      switchMap(() =>
        this.flush().pipe(finalize(() => this.syncing.set(false)))
      ),
    ).subscribe();
  }

  protected queue(key: K, value: T) {
    this.pending.set(key, value);
    this.trigger$.next();
  }

  private flush() {
    if (this.pending.size === 0) return EMPTY;
    const updates = Array.from(this.pending.values());
    this.pending.clear();

    return from(this.write(updates)).pipe(
      tap(() => this.hasError.set(false)),
      catchError((err) => {
        console.error('Persistence failed, retry scheduled', err);
        this.hasError.set(true);
        updates.forEach((u) => this.pending.set(u.key, u));
        // Sans ce retrigger, la queue reste bloquée tant qu'aucune
        // nouvelle frappe utilisateur n'appelle queue().
        timer(DebounceWriter.RETRY_DELAY_MS).subscribe(() => this.trigger$.next());
        return EMPTY;
      }),
    );
  }
}