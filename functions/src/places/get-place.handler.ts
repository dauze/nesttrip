import { Request, Response } from 'express';
// N'oublie pas de créer ton mapPlaceDetails dans place.mapper.ts
import {  mapPlaceDetails, mapPlacePhotos } from './place.mapper';

const FIELD_MASKS = {
  details: [
    'id',
    'regularOpeningHours', 'internationalPhoneNumber', 'nationalPhoneNumber', 'websiteUri', // Ex-Contact
    'rating', 'userRatingCount', 'priceLevel', // Ex-Atmosphere
    'reviews' // Ex-Reviews
  ].join(','),
  photos: ['id', 'photos'].join(','),
} as const;

const MAPPERS = {
  details: mapPlaceDetails,
  photos: mapPlacePhotos,
} as const;

type DetailKind = keyof typeof FIELD_MASKS;

async function fetchPlaceDetail(placeId: string, kind: DetailKind, apiKey: string) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASKS[kind] },
  });
  if (!response.ok) throw new Error(`Google Places ${kind} error: ${response.status}`);
  return response.json();
}

export function makePlaceDetailHandler(kind: DetailKind) {
  return async (req: Request, res: Response, apiKey: string) => {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      res.status(400).json({ error: 'placeId requis' });
      return;
    }
    try {
      const raw = await fetchPlaceDetail(id, kind, apiKey);
      res.json(MAPPERS[kind](raw));
    } catch (err) {
      console.error(`place-${kind} error:`, err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  };
}