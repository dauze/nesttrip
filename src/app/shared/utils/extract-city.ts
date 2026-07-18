/**
 * Extrait, de façon heuristique, le nom de la ville depuis une adresse
 * formatée par l'API Google Places (ex: "16 Rue de la Paix, 75002 Paris,
 * France" ou "2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032, Japon").
 *
 * On ne dispose pas d'un champ "ville" structuré côté client (uniquement
 * l'adresse formatée) : on prend donc l'avant-dernier segment (juste avant
 * le pays) et on retire un éventuel préfixe de code postal.
 */
export function extractCityFromAddress(address: string | undefined | null): string | null {
  if (!address) return null;

  const segments = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length < 2) return null;

  // Avant-dernier segment = généralement "<code postal> <Ville>" ou "Ville <code postal>"
  const candidate = segments[segments.length - 2];

  const city = candidate
    .replace(/\b\d{4,6}\b/g, '') // retire les codes postaux (4 à 6 chiffres)
    .replace(/\s+/g, ' ')
    .trim();

  return city || null;
}
