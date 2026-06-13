import { Place } from "../shared/place.dto";
import { mapPriceLevel, mapPhotos } from "./place.utils";


export function mapPlaceSummary(place: any): Partial<Place> {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    types: place.types,
    priceLevel: mapPriceLevel(place.priceLevel),
    phone: place.internationalPhoneNumber,
    website: place.websiteUri,
    photos: mapPhotos(place.photos),
  };
}

export function mapPlaceDetail(place: any): Place {
  return {
    ...mapPlaceSummary(place) as Place,
    reviews: place.reviews?.map((r: any) => ({
      author: r.authorAttribution?.displayName ?? 'Anonyme',
      rating: r.rating,
      comment: r.text?.text ?? '',
    })),
    openingHours: place.regularOpeningHours?.weekdayDescriptions,
  };
}