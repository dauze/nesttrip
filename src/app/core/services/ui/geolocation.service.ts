import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'nt-geolocation-enabled';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly enabledState = signal(this.readPreference());
  private readonly positionState = signal<{ lat: number; lng: number } | null>(null);
  private readonly accuracyState = signal(0);
  private readonly locatingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private requestId = 0;

  readonly enabled = this.enabledState.asReadonly();
  readonly position = this.positionState.asReadonly();
  readonly accuracy = this.accuracyState.asReadonly();
  readonly locating = this.locatingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  setEnabled(enabled: boolean): void {
    this.enabledState.set(enabled);
    this.storePreference(enabled);
    this.requestId++;
    this.positionState.set(null);
    this.accuracyState.set(0);
    this.errorState.set(null);
    this.locatingState.set(false);
    if (enabled) this.requestPosition();
  }

  requestPosition(): void {
    if (!this.enabled() || this.locating()) return;
    this.errorState.set(null);
    if (!navigator.geolocation) {
      this.errorState.set('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    const requestId = ++this.requestId;
    this.locatingState.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestId !== this.requestId || !this.enabled()) return;
        this.positionState.set({ lat: coords.latitude, lng: coords.longitude });
        this.accuracyState.set(coords.accuracy);
        this.locatingState.set(false);
      },
      (error) => {
        if (requestId !== this.requestId || !this.enabled()) return;
        this.locatingState.set(false);
        this.errorState.set(error.code === 1
          ? 'Accès à la position refusé. Vérifiez les permissions du navigateur.'
          : 'Position indisponible pour le moment.');
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  private readPreference(): boolean {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  }

  private storePreference(enabled: boolean): void {
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { return; }
  }
}