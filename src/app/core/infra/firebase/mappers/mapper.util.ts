/**
 * Retire les clés dont la valeur vaut `undefined` — Firestore n'accepte aucune valeur `undefined`
 * (même imbriquée, voir la doc de chaque `xToFb`) : remplace la répétition manuelle
 * `...(x !== undefined ? { x } : {})` champ par champ (`logisticToFb`, `trip-generation.mapper.ts`).
 * `Partial<T>` en sortie : le type précis attendu par l'appelant se retrouve via un cast local
 * (l'objet passé en entrée porte déjà tous les champs requis, seuls les champs optionnels
 * peuvent être absents).
 */
export function omitUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Date -> epoch-ms stringifié (convention Firestore de ce projet — jamais de `Timestamp` natif) — `undefined` si absente. */
export function dateToFb(date: Date | undefined): string | undefined {
  return date ? String(date.getTime()) : undefined;
}

/** epoch-ms stringifié -> Date — `undefined` si absent. */
export function dateFromFb(raw: string | undefined): Date | undefined {
  return raw ? new Date(Number(raw)) : undefined;
}
