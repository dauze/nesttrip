import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import express from 'express';
import { searchPlacesHandler } from './places/search-places.handler';
import { addCollaboratorHandler } from './collaborators/add-collaborator.handler';
import { removeCollaboratorHandler } from './collaborators/remove-collaborator.handler';
import { removeCompanionHandler } from './companions/remove-companion.handler';
import { authMiddleware } from './shared/auth.middleware';
import { makePlaceDetailHandler } from './places/get-place.handler';
import { getPlacePhotoHandler } from './places/photo.handler';

admin.initializeApp();

const googleApiKey = defineSecret('GOOGLE_PLACES_API_KEY');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  next();
});

app.use(authMiddleware); // ← toutes les routes en dessous sont protégées

app.get('/api/etablissements', (req, res) => searchPlacesHandler(req, res,  googleApiKey.value()));
app.get('/api/etablissements/:id/details', (req, res) => makePlaceDetailHandler('details')(req, res, googleApiKey.value()));
app.get('/api/etablissements/:id/photos', (req, res) => makePlaceDetailHandler('photos')(req, res, googleApiKey.value()));
app.post('/api/collaborators', (req, res) => addCollaboratorHandler(req, res));
app.delete('/api/collaborators/:tripId/:memberUid', (req, res) => removeCollaboratorHandler(req, res));
app.delete('/api/companions/:companionUid', (req, res) => removeCompanionHandler(req, res));
app.get('/api/photos/:photoRef', (req, res) =>  getPlacePhotoHandler(req, res, googleApiKey.value()));

export const api = onRequest(
  { secrets: [googleApiKey], region: 'europe-west1' },
  app
);
