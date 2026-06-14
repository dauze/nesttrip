import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export async function addCollaboratorHandler(req: Request, res: Response) {
  const uid = (req as any).user.uid;

  const { tripId, inviteeEmail, role } = req.body as {
    tripId: string;
    inviteeEmail: string;
    role: string;
  };

  if (!tripId || !inviteeEmail || !role) {
    res.status(400).json({ error: 'tripId, inviteeEmail et role requis' });
    return;
  }

  if (!['editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'Role invalide' });
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

    // Dénormalisation : on stocke role + email + displayName
    await tripRef.update({
      [`members.${invitee.uid}`]: {
        role,
        email: invitee.email ?? inviteeEmail,
        displayName: invitee.displayName ?? null,
      },
    });

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