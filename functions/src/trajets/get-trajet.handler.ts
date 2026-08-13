import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const FIELD_MASK = ['routes.duration', 'routes.distanceMeters'].join(',');

interface ComputeRoutesResponse {
  routes?: { duration?: string; distanceMeters?: number }[];
}

export interface TrajetResult {
  distanceMeters: number;
  durationSeconds: number;
}

type TravelMode = 'walk' | 'bike' | 'car' | 'transit';

const GOOGLE_TRAVEL_MODE: Record<TravelMode, string> = {
  walk: 'WALK',
  bike: 'BICYCLE',
  car: 'DRIVE',
  transit: 'TRANSIT',
};

/** Convertit le format JSON `google.protobuf.Duration` ("1234s") de la Routes API en secondes. */
function parseDurationSeconds(duration: string | undefined): number {
  return duration ? Number(duration.replace(/s$/, '')) : 0;
}

/**
 * Id déterministe du doc `travelRoutes/{routeId}` — MÊME règle que
 * `src/app/core/services/travel-route-id.util.ts` côté client (ces deux
 * copies doivent rester identiques, pas de module partagé entre les deux
 * projets TypeScript). `walk`/`bike` : les 2 placeId triés avant d'être
 * joints (trajet quasi symétrique, divise par ~2 le volume stocké/calculé).
 * `car`/`transit` : ordre origine→destination conservé (trajet asymétrique —
 * trafic pour `car`, réseau/horaires de transport en commun pour `transit`).
 */
function buildRouteId(originPlaceId: string, destinationPlaceId: string, mode: TravelMode): string {
  if (mode === 'car' || mode === 'transit') return `${originPlaceId}_${destinationPlaceId}_${mode}`;
  const [a, b] = [originPlaceId, destinationPlaceId].sort();
  return `${a}_${b}_${mode}`;
}

export async function getTrajetHandler(req: Request, res: Response, apiKey: string) {
  const origin = req.query['origin'];
  const destination = req.query['destination'];
  const mode = req.query['mode'];

  if (!origin || typeof origin !== 'string' || !destination || typeof destination !== 'string') {
    res.status(400).json({ error: 'Paramètres origin/destination (placeId) requis' });
    return;
  }
  if (mode !== 'walk' && mode !== 'bike' && mode !== 'car' && mode !== 'transit') {
    res.status(400).json({ error: 'Paramètre mode requis (walk|bike|car|transit)' });
    return;
  }

  const routeId = buildRouteId(origin, destination, mode);
  const routeRef = admin.firestore().collection('travelRoutes').doc(routeId);

  try {
    // Cache Firestore global (voir ROADMAP.md "Activités"/"UX / Interactions") :
    // évite un appel payant à Google pour une paire+mode déjà calculée, par
    // n'importe quel utilisateur/trip — coût Google asymptotiquement nul à
    // mesure que les paires de lieux se répètent.
    const cached = await routeRef.get();
    if (cached.exists) {
      const data = cached.data() as TrajetResult;
      res.json({ distanceMeters: data.distanceMeters, durationSeconds: data.durationSeconds });
      return;
    }

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
        travelMode: GOOGLE_TRAVEL_MODE[mode],
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

    await routeRef.set({ ...result, computedAt: admin.firestore.FieldValue.serverTimestamp() });

    res.json(result);
  } catch (err) {
    console.error('getTrajet network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
