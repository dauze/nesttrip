import { Request, Response } from 'express';

const FIELD_MASK = ['routes.duration', 'routes.distanceMeters'].join(',');

interface ComputeRoutesResponse {
  routes?: { duration?: string; distanceMeters?: number }[];
}

export interface TrajetResult {
  distanceMeters: number;
  durationSeconds: number;
}

/** Convertit le format JSON `google.protobuf.Duration` ("1234s") de la Routes API en secondes. */
function parseDurationSeconds(duration: string | undefined): number {
  return duration ? Number(duration.replace(/s$/, '')) : 0;
}

export async function getTrajetHandler(req: Request, res: Response, apiKey: string) {
  const origin = req.query['origin'];
  const destination = req.query['destination'];

  if (!origin || typeof origin !== 'string' || !destination || typeof destination !== 'string') {
    res.status(400).json({ error: 'Paramètres origin/destination (placeId) requis' });
    return;
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        origin: { placeId: origin },
        destination: { placeId: destination },
        travelMode: 'WALK',
        units: 'METRIC',
      }),
    });

    if (!response.ok) {
      console.error('Google Routes computeRoutes error:', await response.json());
      res.status(response.status).json({ error: 'Erreur Google Routes API' });
      return;
    }

    const data = (await response.json()) as ComputeRoutesResponse;
    const route = data.routes?.[0];
    if (!route) {
      res.status(404).json({ error: 'Itinéraire introuvable' });
      return;
    }

    const result: TrajetResult = {
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: parseDurationSeconds(route.duration),
    };
    res.json(result);
  } catch (err) {
    console.error('getTrajet network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
