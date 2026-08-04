import { BookingStatus } from '@core/enums/booking.status';
import { DayActivityInstanceFirebase } from '../models/day-activity-instance.dto';
import { DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { bookingFromFb, bookingToFb } from './activity.mapper';

const TIME_STRING_RE = /^\d{1,2}:\d{2}$/;

/**
 * Lit "HH:mm" (format courant) OU un ancien epoch-ms stringifié (format
 * d'avant la simplification du widget horaire, voir ROADMAP.md "Activités") —
 * rétro-compatibilité de lecture permanente, pas de script de migration :
 * l'écriture (`dayActivityInstanceToFb`) n'émet plus jamais que "HH:mm",
 * chaque instance s'auto-met à jour au prochain edit.
 *
 * À NETTOYER une fois la migration silencieuse terminée (quand on est certain
 * qu'aucune instance en base n'a plus l'ancien format epoch-ms — attendre un
 * délai large après le déploiement, toutes les instances actives ayant été
 * rééditées au moins une fois) : supprimer le fallback epoch-ms ci-dessous et
 * ce commentaire, `timeFromFb` peut alors redevenir une simple identité.
 */
function timeFromFb(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (TIME_STRING_RE.test(raw)) return raw;
  const asEpoch = Number(raw);
  if (Number.isNaN(asEpoch)) return undefined;
  const d = new Date(asEpoch);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dayActivityInstanceFromFb(a: DayActivityInstanceFirebase): DayActivityInstance {
  return {
    ...a,
    price: a.price ?? { amount: 0, currency: 'EUR' },
    booking: a.booking ? bookingFromFb(a.booking) : { status: BookingStatus.NOT_NEEDED },
    notes: a.notes ?? '',
    startTime: timeFromFb(a.startTime),
    endTime: timeFromFb(a.endTime),
  };
}

export function dayActivityInstanceToFb(a: DayActivityInstance): DayActivityInstanceFirebase {
  return {
    ...a,
    booking: bookingToFb(a.booking),
    startTime: a.startTime ?? '',
    endTime: a.endTime ?? '',
  };
}
