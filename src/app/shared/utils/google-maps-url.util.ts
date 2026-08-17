/** Vocabulaire `travelmode` attendu par l'URL Google Maps — voir `buildDirectionsUrl`. Traduction depuis le `TravelMode` du domaine laissée à l'appelant (ex. `DayDistanceGapComponent.GOOGLE_MAPS_TRAVEL_MODE`) pour ne pas coupler cet util partagé à un type de `features/`. */
export type GoogleMapsTravelMode = 'walking' | 'bicycling' | 'driving' | 'transit';

export interface MapsDirectionsPoint {
  latitude: number;
  longitude: number;
  placeId: string;
}

/** URL Google Maps "itinéraire" entre deux points — voir `DayDistanceGapComponent.mapsUrl`. */
export function buildDirectionsUrl(origin: MapsDirectionsPoint, destination: MapsDirectionsPoint, mode: GoogleMapsTravelMode): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    origin_place_id: origin.placeId,
    destination: `${destination.latitude},${destination.longitude}`,
    destination_place_id: destination.placeId,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** URL Google Maps "recherche" d'un lieu précis — voir `LogisticPlaceInfoComponent.mapsUrl`. */
export function buildSearchUrl(place: { name: string; address?: string; placeId: string }): string {
  const query = encodeURIComponent(place.address || place.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${place.placeId}`;
}
