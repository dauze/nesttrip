import { Request, Response } from 'express';
import { Place } from './place.dto';

// Mapping Google Places → ton DTO Place
function mapGooglePlaceToDto(place: any): Partial<Place> {
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

function mapPhotos(photos: any[] | undefined): string[] {
  if (!photos?.length) return [];
  // Les URLs de photos nécessitent un appel séparé — on retourne les noms pour l'instant
  return photos.slice(0, 5).map(p => p.name);
}

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
].join(',');

export async function searchPlaces(req: Request, res: Response, apiKey: string) {
  const q = req.query['q'];

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    res.status(400).json({ error: 'Paramètre q requis (min 2 caractères)' });
    return;
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: q.trim(),
      languageCode: 'fr',   // résultats en français
      maxResultCount: 10,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Google Places searchText error:', err);
    res.status(response.status).json({ error: 'Erreur Google Places API' });
    return;
  }

  const data = await response.json();
  const places = (data.places ?? []).map(mapGooglePlaceToDto);
  res.json(places);
}