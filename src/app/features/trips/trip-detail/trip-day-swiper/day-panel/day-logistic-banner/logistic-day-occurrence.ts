import { Logistic } from '@core/models/logistic.dto';

export interface LogisticDayOccurrence {
  logistic: Logistic;
  /** Libellé du rôle joué par CE jour dans la plage de la réservation (ex. "Check-in" vs "Check-out"). */
  role: string;
  /** Heure à afficher pour ce rôle (début pour un rôle "entrée", fin pour un rôle "sortie"). */
  time: Date;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Détermine, pour un jour donné, quel(s) "rôle(s)" une réservation y joue —
 * une réservation peut apparaître sur plusieurs jours (ex. un hôtel de
 * plusieurs nuits) avec un rôle différent selon le jour (entrée/sortie/nuit
 * intermédiaire). Ne renvoie rien si la réservation ne touche pas ce jour.
 */
export function getLogisticDayOccurrences(logistic: Logistic, dayId: Date): LogisticDayOccurrence[] {
  // Pas de date renseignée : ne touche encore aucun jour (voir ROADMAP.md — même principe qu'une activité non placée, pas de bandeau tant que non daté).
  const { startDateTime, endDateTime } = logistic;
  if (!startDateTime || !endDateTime) return [];

  const day = startOfDay(dayId);
  const startDay = startOfDay(startDateTime);
  const endDay = startOfDay(endDateTime);

  if (day < startDay || day > endDay) return [];

  const isStart = day === startDay;
  const isEnd = day === endDay;
  const isBetween = day > startDay && day < endDay;

  switch (logistic.type) {
    case 'logement':
      if (isStart) return [{ logistic, role: 'Check-in', time: startDateTime }];
      if (isEnd) return [{ logistic, role: 'Check-out', time: endDateTime }];
      if (isBetween) return [{ logistic, role: 'Nuit sur place', time: startDateTime }];
      return [];
    case 'flight': {
      const occurrences: LogisticDayOccurrence[] = [];
      if (isStart) occurrences.push({ logistic, role: 'Départ', time: startDateTime });
      if (isEnd && !isStart) occurrences.push({ logistic, role: 'Arrivée', time: endDateTime });
      return occurrences;
    }
    case 'carRental': {
      const occurrences: LogisticDayOccurrence[] = [];
      if (isStart) occurrences.push({ logistic, role: 'Prise en charge', time: startDateTime });
      if (isEnd) occurrences.push({ logistic, role: 'Restitution', time: endDateTime });
      return occurrences;
    }
    case 'other':
      if (isStart) return [{ logistic, role: 'Début', time: startDateTime }];
      if (isEnd) return [{ logistic, role: 'Fin', time: endDateTime }];
      return [{ logistic, role: 'En cours', time: startDateTime }];
  }
}
