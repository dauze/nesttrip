import { Request, Response } from 'express';
import { mapPlaceDetail } from './place.mapper';

const DETAIL_FIELD_MASK = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating',
  'userRatingCount', 'reviews', 'regularOpeningHours', 'types',
  'priceLevel', 'internationalPhoneNumber', 'websiteUri', 'photos',
].join(',');

export async function getPlaceHandler(req: Request, res: Response, apiKey: string) {
  const id = req.params['id'];
  if (!id) { res.status(400).json({ error: 'Place ID requis' }); return; }

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': DETAIL_FIELD_MASK,
        'Accept-Language': 'fr',
      },
    });

    if (!response.ok) {
      console.error('Google Places detail error:', await response.json());
      res.status(response.status).json({ error: 'Lieu introuvable' });
      return;
    }

    res.json(mapPlaceDetail(await response.json()));
  } catch (err) {
    console.error('getPlace network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}