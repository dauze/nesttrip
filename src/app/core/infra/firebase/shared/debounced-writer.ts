import { signal } from "@angular/core";
import { Subject, debounceTime, tap, switchMap, finalize, EMPTY, from, catchError } from "rxjs";

// base-persistence.service.ts
export abstract class DebounceWriter<K, T extends { key: K }> {
  protected abstract write(updates: T[]): Promise<unknown>;

  readonly syncing = signal(false);
  private readonly pending = new Map<K, T>();
  private readonly trigger$ = new Subject<void>();

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
      catchError((err) => {
        console.error('Persistence failed', err);
        updates.forEach((u) => this.pending.set(u.key, u));
        return EMPTY;
      }),
    );
  }
}