const FIELD_MASK = ['places.id', 'places.displayName', 'places.location'].join(',');

export interface GeocodedCity {
  ville: string;
  placeId: string;
  latitude: number;
  longitude: number;
}

/**
 * Résout un nom de ville (texte libre, saisi via le champ "Plusieurs villes ?"
 * du Lot 1 — voir `TripAiPreferences.cities`, de simples strings, aucun
 * placeId/coordonnées capturés côté client) en coordonnées, nécessaires pour
 * chercher activités/logements autour de CHAQUE ville en mode `full_plan`
 * multi-villes (§4.1/§4.2). Même endpoint Google (`searchText`) que
 * `search-places.handler.ts` côté recherche de destination — premier
 * résultat retenu (pas de désambiguïsation UI possible ici, contrairement au
 * champ Destination principal qui, lui, passe par une vraie sélection
 * utilisateur).
 */
export async function geocodeCity(ville: string, apiKey: string): Promise<GeocodedCity | null> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: ville, languageCode: 'fr', maxResultCount: 1 }),
  });

  if (!response.ok) {
    console.error(`geocodeCity (${ville}) error:`, await response.text());
    return null;
  }

  const data = (await response.json()) as {
    places?: { id: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number } }[];
  };
  const place = data.places?.[0];
  if (!place?.location?.latitude || !place.location.longitude) return null;

  return {
    ville: place.displayName?.text ?? ville,
    placeId: place.id,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  };
}
