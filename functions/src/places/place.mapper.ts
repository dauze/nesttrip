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
  photoRef: PlacePhotoRef | null; // une seule photo, jamais un tableau
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

export function mapPlaceSummary(place: any): PlaceSummary {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    // on ne garde que la 1ere photo : gain de payload, pas de gain de billing,
    // mais évite de trimballer un tableau inutile jusqu'au front
    photoRef: place.photos?.[0]
      ? { name: place.photos[0].name, widthPx: place.photos[0].widthPx, heightPx: place.photos[0].heightPx }
      : null,
  };
}

export function mapPlaceContact(place: any): PlaceContact {
  return {
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? '',
    website: place.websiteUri ?? '',
  };
}

export function mapPlaceAtmosphere(place: any): PlaceAtmosphere {
  return {
    rating: place.rating ?? 0,
    reviewCount: place.userRatingCount ?? 0,
    priceLevel: mapPriceLevel(place.priceLevel),
  };
}

export function mapPlaceReviews(place: any): PlaceReviews {
  return {
    reviews: (place.reviews ?? []).map((r: any) => ({
      author: r.authorAttribution?.displayName ?? 'Anonyme',
      rating: r.rating ?? 0,
      comment: r.text?.text ?? '',
    })),
  };
}

function mapPriceLevel(level: string | undefined): number {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level ? (map[level] ?? 0) : 0;
}

export interface PlacePhotos {
  photos: PlacePhotoRef[];
}

export function mapPlacePhotos(place: any): PlacePhotos {
  return {
    photos: (place.photos ?? []).slice(0, 6).map((p: any) => ({
      name: p.name,
      widthPx: p.widthPx,
      heightPx: p.heightPx,
    })),
  };
}