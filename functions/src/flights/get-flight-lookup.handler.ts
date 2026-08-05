import { Request, Response } from 'express';
import { AeroDataBoxFlight, mapFlightLookup } from './flight.mapper';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Proxy AeroDataBox — même appel/tier que `getFlightStatusHandler` ("FIDS by
 * flight number"), réponse mappée différemment (compagnie/aéroports/horaires
 * prévus plutôt que le statut temps réel) : utilisé uniquement à la création
 * guidée d'une réservation de type vol (voir ROADMAP.md).
 */
export async function getFlightLookupHandler(req: Request, res: Response, apiKey: string) {
  const { flightNumber } = req.params;
  const date = req.query['date'];

  if (!flightNumber || Array.isArray(flightNumber) || typeof date !== 'string' || !DATE_RE.test(date)) {
    res.status(400).json({ error: 'flightNumber et date (YYYY-MM-DD) requis' });
    return;
  }

  try {
    const response = await fetch(
      `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber)}/${date}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
        },
      },
    );

    if (!response.ok) {
      console.error('AeroDataBox error:', await response.text());
      res.status(response.status).json({ error: 'Erreur AeroDataBox API' });
      return;
    }

    const data = (await response.json()) as AeroDataBoxFlight[] | AeroDataBoxFlight;
    const flight = Array.isArray(data) ? data[0] : data;

    if (!flight) {
      res.status(404).json({ error: 'Vol introuvable' });
      return;
    }

    res.json(mapFlightLookup(flight));
  } catch (err) {
    console.error('getFlightLookup network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
