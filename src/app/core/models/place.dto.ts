export interface PlacePhotoRef {
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface PlaceSummary {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** Code pays ISO 3166-1 alpha-2 (ex. "TH") — voir `suggestedCurrencyForCountry` (src/specs/devise.md 3.1). */
  countryCode?: string;
}

export interface PlaceDetails {
  openingHours: string[];
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  reviews: { author: string; rating: number; comment: string }[];
  /** Code pays ISO 3166-1 alpha-2 (ex. "TH") — voir `suggestedCurrencyForCountry` (src/specs/devise.md 3.5, devise locale destination). */
  countryCode?: string;
}

export interface PlacePhotos {
  photos: PlacePhotoRef[];
}

export type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error' };