import { Request, Response } from 'express';
import { mapPlaceSummary } from './place.mapper';

// Uniquement Basic Data → aucun Data SKU additionnel, tarif Pro de base seulement
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
].join(',');

export async function searchPlacesHandler(req: Request, res: Response, apiKey: string) {
  const q = req.query['q'];
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    res.status(400).json({ error: 'Paramètre q requis (min 2 caractères)' });
    return;
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: q.trim(), languageCode: 'fr', maxResultCount: 10 }),
    });

    if (!response.ok) {
      console.error('Google Places searchText error:', await response.json());
      res.status(response.status).json({ error: 'Erreur Google Places API' });
      return;
    }

    const data = await response.json();
    res.json((data.places ?? []).map(mapPlaceSummary));
  } catch (err) {
    console.error('searchPlaces network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}