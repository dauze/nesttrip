import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import express from 'express';
import { searchPlacesHandler } from './places/search-places.handler';
import { addCollaboratorHandler } from './collaborators/add-collaborator.handler';
import { authMiddleware } from './shared/auth.middleware';
import { makePlaceDetailHandler } from './places/get-place.handler';
import { getPlacePhotoHandler } from './places/photo.handler';

admin.initializeApp();

const googleApiKey = defineSecret('GOOGLE_PLACES_API_KEY');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  next();
});

app.use(authMiddleware); // ← toutes les routes en dessous sont protégées

app.get('/api/etablissements', (req, res) => searchPlacesHandler(req, res,  googleApiKey.value()));
app.get('/api/etablissements/:id/contact', (req, res) => makePlaceDetailHandler('contact')(req, res,  googleApiKey.value()));
app.get('/api/etablissements/:id/atmosphere', (req, res) => makePlaceDetailHandler('atmosphere')(req, res,  googleApiKey.value()));
app.get('/api/etablissements/:id/reviews', (req, res) => makePlaceDetailHandler('reviews')(req, res,  googleApiKey.value()));
app.post('/api/collaborators', (req, res) => addCollaboratorHandler(req, res));
app.get('/api/etablissements/:id/photos', (req, res) => makePlaceDetailHandler('photos')(req, res,  googleApiKey.value()));
app.get('/api/photos/:photoRef', (req, res) =>  getPlacePhotoHandler(req, res, googleApiKey.value()));

export const api = onRequest(
  { secrets: [googleApiKey], region: 'europe-west1' },
  app
);
