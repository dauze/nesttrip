import { Request, Response } from 'express';
import { Place } from './place.dto';

const DETAIL_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'reviews',
  'regularOpeningHours',
  'types',
  'priceLevel',
  'internationalPhoneNumber',
  'websiteUri',
  'photos',
].join(',');

function mapGooglePlaceDetailToDto(place: any): Place {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    reviews: place.reviews?.map((r: any) => ({
      author: r.authorAttribution?.displayName ?? 'Anonyme',
      rating: r.rating,
      comment: r.text?.text ?? '',
    })),
    openingHours: place.regularOpeningHours?.weekdayDescriptions,
    phone: place.internationalPhoneNumber,
    website: place.websiteUri,
    types: place.types,
    priceLevel: mapPriceLevel(place.priceLevel),
    photos: place.photos?.slice(0, 10).map((p: any) => p.name) ?? [],
  };
}

// (même helper que dans search-places.ts → à factoriser dans un utils.ts)
function mapPriceLevel(priceLevel: string | undefined): number | undefined {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return priceLevel ? map[priceLevel] : undefined;
}

export async function getPlace(req: Request, res: Response, apiKey: string) {
  const id = req.params['id'];

  if (!id) {
    res.status(400).json({ error: 'Place ID requis' });
    return;
  }

  const response = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAIL_FIELD_MASK,
      'Accept-Language': 'fr',
    },
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Google Places details error:', err);
    res.status(response.status).json({ error: 'Lieu introuvable' });
    return;
  }

  const place = await response.json();
  res.json(mapGooglePlaceDetailToDto(place));
}