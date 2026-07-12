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
  photoRef: PlacePhotoRef | null;
}

export interface PlaceContact {
  openingHours: string[];
  phone: string;
  website: string;
}

export interface PlaceAtmosphere {
  rating: number;
  reviewCount: number;
  priceLevel: number;
}

export interface PlaceReview {
  author: string;
  rating: number;
  comment: string;
}

export interface PlaceReviews {
  reviews: PlaceReview[];
}

export interface PlacePhotos {
  photos: PlacePhotoRef[];
}

export type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error' };