import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export async function removeCompanionHandler(req: Request, res: Response) {
  const uid = (req as any).user.uid;
  const { companionUid } = req.params as { companionUid: string };

  if (!companionUid) {
    res.status(400).json({ error: 'companionUid requis' });
    return;
  }

  try {
    const db = admin.firestore();
    await db.doc(`users/${uid}`).update({
      [`companions.${companionUid}`]: admin.firestore.FieldValue.delete(),
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('removeCompanion error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
