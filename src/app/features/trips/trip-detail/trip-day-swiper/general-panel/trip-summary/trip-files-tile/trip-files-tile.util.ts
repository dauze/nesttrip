import { Activity } from '@app/shared/components/activity-card/activity.model';
import { ACTIVITY_TYPE_META } from '@app/shared/components/activity-card/activity.constants';
import { Logistic } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META } from '../../logistics/logistic.constants';

export interface FileItem {
  path: string;
  name: string;
  url: string;
}

export interface FileGroup {
  key: string;
  title: string;
  icon: string;
  colorVar: string;
  files: FileItem[];
}

/**
 * Groupe les fichiers joints par activité/réservation d'origine — voir
 * `TripFilesTileComponent` pour le contexte/la doc complète. Extrait en
 * fonction pure (testable sans `TestBed`, voir `nesttrip-testing`) : ne fait
 * que dérouler/dédupliquer/filtrer des tableaux déjà résolus, aucune
 * dépendance à `TripFacade`.
 *
 * `placedActivities` : dédupliqué par `activity.activityId` (le pool, pas
 * l'instance de placement — les fichiers vivent UNIQUEMENT sur le pool, voir
 * CLAUDE.md "Pool léger + instances par jour", jamais dupliqués par jour de
 * placement), en gardant la PREMIÈRE occurrence rencontrée (ordre
 * chronologique des jours, déjà l'ordre de `placedActivities` en entrée).
 */
export function computeFileGroups(
  placedActivities: { activity: Activity }[],
  logistics: Logistic[],
): FileGroup[] {
  const groups: FileGroup[] = [];
  const seenActivityIds = new Set<string>();

  for (const { activity } of placedActivities) {
    if (seenActivityIds.has(activity.activityId)) continue;
    seenActivityIds.add(activity.activityId);
    if (!activity.files.length) continue;

    const meta = ACTIVITY_TYPE_META[activity.type];
    groups.push({
      key: `activity:${activity.activityId}`,
      title: activity.title || meta.label,
      icon: meta.icon,
      colorVar: meta.colorVar,
      files: activity.files,
    });
  }

  for (const logistic of logistics) {
    if (!logistic.files.length) continue;

    const meta = LOGISTIC_TYPE_META[logistic.type];
    groups.push({
      key: `logistic:${logistic.id}`,
      title: logistic.title || meta.label,
      icon: meta.icon,
      colorVar: meta.colorVar,
      files: logistic.files,
    });
  }

  return groups;
}
