import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import express from 'express';
import { searchPlaces } from './search-places';
import { getPlace } from './get-place';

const googleApiKey = defineSecret('GOOGLE_PLACES_API_KEY');

const app = express();
app.use(express.json());

// CORS — à adapter à ton domaine en prod
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*'); // restreindre en prod
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  next();
});

// GET /api/etablissements?q=paris+restaurant
app.get('/etablissements', (req, res) =>
  searchPlaces(req, res, googleApiKey.value())
);

// GET /api/etablissements/:id
app.get('/etablissements/:id', (req, res) =>
  getPlace(req, res, googleApiKey.value())
);

export const api = onRequest(
  { secrets: [googleApiKey], region: 'europe-west1' },
  app
);