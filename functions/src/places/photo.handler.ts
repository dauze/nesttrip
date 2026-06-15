import { Request, Response } from 'express';

/**
 * GET /api/photos/:photoRef
 *
 * photoRef est la référence Google Places brute, ex :
 *   places/ChIJTdh.../photos/AaVGc3n...
 *
 * Express encode les slashes dans les params — on reconstruit la ref
 * depuis req.path pour gérer les slashes internes.
 *
 * Paramètres query optionnels :
 *   ?maxWidth=800   (défaut : 800)
 *   ?maxHeight=600
 */
export async function getPlacePhotoHandler(req: Request, res: Response, apiKey: string) {
  // Reconstruit la référence complète depuis le path
  // Le router doit être monté avec app.get('/api/photos/*', ...)
  const photoRef = req.params.photoRef;

  if (!photoRef) {
    res.status(400).json({ error: 'Photo reference requise' });
    return;
  }

  const maxWidth = req.query['maxWidth'] ?? '800';
  const maxHeight = req.query['maxHeight'];

  const params = new URLSearchParams({ key: apiKey });
  params.set('maxWidthPx', String(maxWidth));
  if (maxHeight) params.set('maxHeightPx', String(maxHeight));
  // skipHttpRedirect=true → retourne le JSON avec l'URI plutôt que de rediriger
  params.set('skipHttpRedirect', 'true');

  try {
    const metaUrl = `https://places.googleapis.com/v1/${photoRef}/media?${params}`;
    const metaRes = await fetch(metaUrl, {
      headers: { 'X-Goog-Api-Key': apiKey },
    });

    if (!metaRes.ok) {
      console.error('Google Places photo error:', metaRes.status, await metaRes.text());
      res.status(metaRes.status).json({ error: 'Photo introuvable' });
      return;
    }

    const meta = await metaRes.json() as { photoUri: string };

    if (!meta.photoUri) {
      res.status(404).json({ error: 'photoUri absent de la réponse Google' });
      return;
    }

    // Stream l'image depuis l'URI Google vers le client
    const imgRes = await fetch(meta.photoUri);
    if (!imgRes.ok || !imgRes.body) {
      res.status(502).json({ error: 'Impossible de récupérer l\'image' });
      return;
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const cacheControl = 'public, max-age=86400'; // 24h — OK selon les CGU Google (pas de stockage persistant)

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);

    // Stream via Node.js ReadableStream → Response
    const reader = imgRes.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(Buffer.from(value));
      }
    };
    await pump();

  } catch (err) {
    console.error('getPlacePhoto network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}