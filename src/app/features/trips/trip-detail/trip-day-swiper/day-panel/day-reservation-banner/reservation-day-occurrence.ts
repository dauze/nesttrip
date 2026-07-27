import { Reservation } from '@core/models/reservation.dto';

export interface ReservationDayOccurrence {
  reservation: Reservation;
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
export function getReservationDayOccurrences(reservation: Reservation, dayId: Date): ReservationDayOccurrence[] {
  const day = startOfDay(dayId);
  const startDay = startOfDay(reservation.startDateTime);
  const endDay = startOfDay(reservation.endDateTime);

  if (day < startDay || day > endDay) return [];

  const isStart = day === startDay;
  const isEnd = day === endDay;
  const isBetween = day > startDay && day < endDay;

  switch (reservation.type) {
    case 'hotel':
      if (isStart) return [{ reservation, role: 'Check-in', time: reservation.startDateTime }];
      if (isEnd) return [{ reservation, role: 'Check-out', time: reservation.endDateTime }];
      if (isBetween) return [{ reservation, role: 'Nuit sur place', time: reservation.startDateTime }];
      return [];
    case 'flight': {
      const occurrences: ReservationDayOccurrence[] = [];
      if (isStart) occurrences.push({ reservation, role: 'Départ', time: reservation.startDateTime });
      if (isEnd && !isStart) occurrences.push({ reservation, role: 'Arrivée', time: reservation.endDateTime });
      return occurrences;
    }
    case 'carRental': {
      const occurrences: ReservationDayOccurrence[] = [];
      if (isStart) occurrences.push({ reservation, role: 'Prise en charge', time: reservation.startDateTime });
      if (isEnd) occurrences.push({ reservation, role: 'Restitution', time: reservation.endDateTime });
      return occurrences;
    }
    case 'other':
      if (isStart) return [{ reservation, role: 'Début', time: reservation.startDateTime }];
      if (isEnd) return [{ reservation, role: 'Fin', time: reservation.endDateTime }];
      return [{ reservation, role: 'En cours', time: reservation.startDateTime }];
  }
}
