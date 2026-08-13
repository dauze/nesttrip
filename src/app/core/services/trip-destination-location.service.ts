import { Injectable, inject } from '@angular/core';
import { from, Observable, of, shareReplay, switchMap, catchError } from 'rxjs';
import { GoogleMapsLoaderService } from './google-maps-loader.service';

/**
 * Résout un `Trip.placeId` en coordonnées (`google.maps.Geocoder`, la carte
 * étant déjà chargée côté client — pas besoin du backend maison ici,
 * contrairement à `GooglePlaceService`) — utilisé par `TripDaySwiperComponent`
 * pour poser `TripDayMapComponent.defaultCenter` (ROADMAP.md "### UI", "la
 * carte doit être centrée sur le placeid du trip" quand le jour/contexte
 * affiché n'a aucune activité géolocalisée, au lieu d'un repli Paris fixe).
 */
@Injectable({ providedIn: 'root' })
export class TripDestinationLocationService {
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private geocoder?: google.maps.Geocoder;
  private readonly cache = new Map<string, Observable<google.maps.LatLngLiteral | null>>();

  getCoordinates$(placeId: string): Observable<google.maps.LatLngLiteral | null> {
    let coords$ = this.cache.get(placeId);
    if (!coords$) {
      coords$ = from(this.mapsLoader.load()).pipe(
        switchMap(() => from(this.geocode(placeId))),
        catchError(() => of(null)),
        shareReplay(1),
      );
      this.cache.set(placeId, coords$);
    }
    return coords$;
  }

  private async geocode(placeId: string): Promise<google.maps.LatLngLiteral | null> {
    this.geocoder ??= new google.maps.Geocoder();
    const { results } = await this.geocoder.geocode({ placeId });
    const location = results[0]?.geometry?.location;
    return location ? { lat: location.lat(), lng: location.lng() } : null;
  }
}
