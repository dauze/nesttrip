import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export async function addCollaboratorHandler(req: Request, res: Response) {
  const uid = (req as any).user.uid;

  const { tripId, inviteeEmail } = req.body as {
    tripId: string;
    inviteeEmail: string;
  };

  if (!tripId || !inviteeEmail) {
    res.status(400).json({ error: 'tripId, inviteeEmail et role requis' });
    return;
  }

  try {
    const db = admin.firestore();
    const tripRef = db.collection('trips').doc(tripId);
    const trip = await tripRef.get();

    if (!trip.exists) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    const members = trip.data()?.members as Record<string, { role: string }>;
    if (members[uid]?.role !== 'owner') {
      res.status(403).json({ error: 'Only owners can invite' });
      return;
    }

    const invitee = await admin.auth().getUserByEmail(inviteeEmail);
    const actor = await admin.auth().getUser(uid);

    // Dénormalisation : on stocke role + email + displayName
    await tripRef.update({
      [`members.${invitee.uid}`]: {
        role : 'editor',
        email: invitee.email ?? inviteeEmail,
        displayName: invitee.displayName ?? null,
      },
    });

    // Companions de route bidirectionnels : A invite B => B apparaît chez A ET A apparaît chez B.
    // set(..., { merge: true }) crée les docs users/{uid} s'ils n'existent pas encore.
    await Promise.all([
      db.doc(`users/${actor.uid}`).set(
        {
          uid: actor.uid,
          email: actor.email ?? null,
          displayName: actor.displayName ?? null,
          companions: {
            [invitee.uid]: {
              uid: invitee.uid,
              email: invitee.email ?? inviteeEmail,
              displayName: invitee.displayName ?? null,
            },
          },
        },
        { merge: true },
      ),
      db.doc(`users/${invitee.uid}`).set(
        {
          uid: invitee.uid,
          email: invitee.email ?? inviteeEmail,
          displayName: invitee.displayName ?? null,
          companions: {
            [actor.uid]: {
              uid: actor.uid,
              email: actor.email ?? null,
              displayName: actor.displayName ?? null,
            },
          },
        },
        { merge: true },
      ),
    ]);

    res.json({
      success: true,
      uid: invitee.uid,
      email: invitee.email ?? inviteeEmail,
      displayName: invitee.displayName ?? null,
    });
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    console.error('addCollaborator error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}