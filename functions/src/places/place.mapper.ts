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

// --------------------------------------------------------
// NOUVEAU MODÈLE REGROUPÉ : Contact + Atmosphere + Reviews
// --------------------------------------------------------
export interface PlaceDetails {
  openingHours: string[];
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  reviews: Array<{ author: string; rating: number; comment: string }>;
}

export interface PlacePhotos {
  photos: PlacePhotoRef[];
}

export function mapPlaceSummary(place: any): PlaceSummary {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
  };
}

// --------------------------------------------------------
// MAPPING REGROUPÉ
// --------------------------------------------------------
export function mapPlaceDetails(place: any): PlaceDetails {
  return {
    // Contact
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? '',
    website: place.websiteUri ?? '',
    
    // Atmosphere
    rating: place.rating ?? 0,
    reviewCount: place.userRatingCount ?? 0,
    priceLevel: mapPriceLevel(place.priceLevel),
    
    // Avis
    reviews: (place.reviews ?? []).map((r: any) => ({
      author: r.authorAttribution?.displayName ?? 'Anonyme',
      rating: r.rating ?? 0,
      comment: r.text?.text ?? '',
    })),
  };
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

// --------------------------------------------------------
// UTILITAIRES
// --------------------------------------------------------
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