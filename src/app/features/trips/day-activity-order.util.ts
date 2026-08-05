import { timeToMinutes } from '@app/shared/components/activity-card/activity-time.util';

/**
 * Réinsère `movedId` au bon endroit chronologique parmi `ids`, sans jamais
 * déplacer les activités SANS heure (elles gardent leur position manuelle
 * relative, voir ROADMAP.md "Activités") — seules les activités TIMÉES
 * contraignent le point d'insertion, les non-timées croisées en chemin sont
 * ignorées pour la comparaison mais restent à leur place relative dans le
 * tableau final.
 */
export function insertChronologically(
  ids: string[],
  movedId: string,
  movedStartTime: string,
  getStartTime: (id: string) => string | undefined,
): string[] {
  const withoutMoved = ids.filter((id) => id !== movedId);
  const movedMinutes = timeToMinutes(movedStartTime);

  let insertAt = withoutMoved.length;
  for (let i = 0; i < withoutMoved.length; i++) {
    const otherTime = getStartTime(withoutMoved[i]);
    if (otherTime === undefined) continue;
    if (timeToMinutes(otherTime) > movedMinutes) {
      insertAt = i;
      break;
    }
  }

  const result = [...withoutMoved];
  result.splice(insertAt, 0, movedId);
  return result;
}
