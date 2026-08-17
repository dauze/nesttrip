/**
 * Google Places renvoie parfois `name` comme une string, parfois comme un objet
 * `{ text: string }` (Autocomplete "New") selon le champ/l'endpoint — ce helper
 * normalise les deux formes. Utilisé partout où une sélection Places alimente un
 * champ texte (`ActivityHeaderComponent`, `TitleEditDialogComponent`,
 * `NewActivityDraftComponent`, `PlaceAutocompleteFieldComponent`).
 */
export function extractPlaceName(name: unknown): string {
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
    return (name as { text: string }).text;
  }
  return '';
}
