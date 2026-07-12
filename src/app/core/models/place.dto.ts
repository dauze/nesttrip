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
}

export interface PlaceDetails {
  openingHours: string[];
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  reviews: { author: string; rating: number; comment: string }[];
}

export interface PlacePhotos {
  photos: PlacePhotoRef[];
}

export type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error' };