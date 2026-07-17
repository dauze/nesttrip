import { Injectable } from "@angular/core";
import { environment } from "@environments/environment";

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadingPromise?: Promise<void>;

  load(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');

      const params = new URLSearchParams({
        key: environment.googleMapsApiKey,
        libraries: 'marker',
        loading: 'async',
      });

      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      script.defer = true;

      script.onload = () => resolve();
      script.onerror = reject;

      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }
}