import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export async function addCollaboratorHandler(req: Request, res: Response) {
  const uid = (req as any).user.uid; // déjà vérifié par le middleware

  const { tripId, inviteeEmail, role } = req.body;
  if (!tripId || !inviteeEmail || !role) {
    res.status(400).json({ error: 'tripId, inviteeEmail et role requis' });
    return;
  }

  try {
    const db = admin.firestore();
    const tripRef = db.collection('trips').doc(tripId);
    const trip = await tripRef.get();

    if (!trip.exists) { res.status(404).json({ error: 'Trip not found' }); return; }
    if (trip.data()?.members[uid] !== 'owner') {
      res.status(403).json({ error: 'Only owners can invite' });
      return;
    }

    const invitee = await admin.auth().getUserByEmail(inviteeEmail);
    await tripRef.update({ [`members.${invitee.uid}`]: role });

    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    console.error('addCollaborator error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}