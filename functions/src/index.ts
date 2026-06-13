import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import express from 'express';
import { searchPlaces } from './search-places';
import { getPlace } from './get-place';

// Initialiser admin SDK une seule fois
admin.initializeApp();
const db = admin.firestore();

const googleApiKey = defineSecret('GOOGLE_PLACES_API_KEY');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  next();
});

app.get('/api/etablissements', (req, res) =>
  searchPlaces(req, res, googleApiKey.value())
);

app.get('/api/etablissements/:id', (req, res) =>
  getPlace(req, res, googleApiKey.value())
);

export const api = onRequest(
  { secrets: [googleApiKey], region: 'europe-west1' },
  app
);

export const addCollaborator = onCall(async ({ data, auth }) => {
  if (!auth) throw new HttpsError('unauthenticated', 'Login required');

  const { tripId, inviteeEmail, role } = data;

  const tripRef = db.collection('trips').doc(tripId);
  const trip = await tripRef.get();

  if (!trip.exists) {
    throw new HttpsError('not-found', 'Trip not found');
  }

  if (trip.data()?.members[auth.uid] !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owners can invite');
  }

  const invitee = await admin.auth().getUserByEmail(inviteeEmail);

  await tripRef.update({
    [`members.${invitee.uid}`]: role,
  });

  return { success: true };
});