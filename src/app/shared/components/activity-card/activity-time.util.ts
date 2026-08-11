/** Minutes depuis minuit pour une heure au format "HH:mm" (stockage `DayActivityInstance.startTime`/`endTime`). */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Inverse de `timeToMinutes` — minutes depuis minuit vers "HH:mm", modulo 24h (pas de gestion de dépassement de jour ici, voir `endDayOffset` pour ça). */
export function minutesToTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Nombre de jours après le jour de début où l'activité se termine réellement
 * (0 = même jour). `endDayOffset` est le champ explicite posé par le
 * sélecteur "J+N" (voir ROADMAP.md "UX / Interactions") ; en son absence
 * (activités créées avant son introduction, ou fin < début jamais retouchée
 * depuis), retombe sur l'ancienne règle implicite : fin < début ⇒ +1 jour,
 * jamais plus (c'était la seule valeur possible avant ce champ).
 */
export function resolveEndDayOffset(
  startTime: string | undefined,
  endTime: string | undefined,
  endDayOffset: number | undefined,
): number {
  if (endDayOffset !== undefined) return endDayOffset;
  if (!startTime || !endTime) return 0;
  return timeToMinutes(endTime) < timeToMinutes(startTime) ? 1 : 0;
}
