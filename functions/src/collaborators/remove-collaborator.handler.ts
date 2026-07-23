import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export async function removeCollaboratorHandler(req: Request, res: Response) {
  const uid = (req as any).user.uid;
  const { tripId, memberUid } = req.params as { tripId: string; memberUid: string };

  if (!tripId || !memberUid) {
    res.status(400).json({ error: 'tripId et memberUid requis' });
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
      res.status(403).json({ error: 'Only owners can remove members' });
      return;
    }

    if (memberUid === uid) {
      res.status(400).json({ error: 'Le créateur ne peut pas se retirer lui-même, supprimez le voyage à la place' });
      return;
    }

    if (!members[memberUid]) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    await tripRef.update({
      [`members.${memberUid}`]: admin.firestore.FieldValue.delete(),
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('removeCollaborator error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
