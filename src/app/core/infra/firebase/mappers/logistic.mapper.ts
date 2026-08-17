import { BookingStatus } from '@core/enums/booking.status';
import { FlightStatus, Logistic } from '@core/models/logistic.dto';
import { FlightStatusFirebase, LogisticFirebase } from '../models/logistic.dto';
import { bookingFromFb, bookingToFb, priceFromFb, priceToFb } from './activity.mapper';
import { dateFromFb, dateToFb, omitUndefined } from './mapper.util';

function flightStatusFromFb(s: FlightStatusFirebase): FlightStatus {
  return {
    ...s,
    actualDepartureTime: dateFromFb(s.actualDepartureTime),
    actualArrivalTime: dateFromFb(s.actualArrivalTime),
  };
}

export function flightStatusToFb(s: FlightStatus): FlightStatusFirebase {
  return {
    ...s,
    actualDepartureTime: s.actualDepartureTime ? String(s.actualDepartureTime.getTime()) : '',
    actualArrivalTime: s.actualArrivalTime ? String(s.actualArrivalTime.getTime()) : '',
  };
}

export function logisticFromFb(r: LogisticFirebase): Logistic {
  const base = {
    id: r.id,
    title: r.title,
    startDateTime: dateFromFb(r.startDateTime),
    endDateTime: dateFromFb(r.endDateTime),
    referenceNumber: r.referenceNumber,
    notes: r.notes ?? '',
    files: r.files ?? [],
    links: r.links ?? [],
    price: r.price ? priceFromFb(r.price) : undefined,
    booking: r.booking ? bookingFromFb(r.booking) : { status: BookingStatus.NOT_NEEDED },
  };

  switch (r.type) {
    case 'logement':
      return { ...base, type: 'logement', place: r.place };
    case 'flight':
      return {
        ...base,
        type: 'flight',
        airline: r.airline,
        flightNumber: r.flightNumber,
        departureAirport: r.departureAirport,
        arrivalAirport: r.arrivalAirport,
        status: r.status ? flightStatusFromFb(r.status) : undefined,
        statusFetchedAt: r.statusFetchedAt ? new Date(Number(r.statusFetchedAt)) : undefined,
      };
    case 'carRental':
      return {
        ...base,
        type: 'carRental',
        company: r.company,
        pickupPlace: r.pickupPlace,
        dropoffPlace: r.dropoffPlace,
      };
    case 'train':
      return { ...base, type: 'train', departurePlace: r.departurePlace, arrivalPlace: r.arrivalPlace };
    case 'other':
      return { ...base, type: 'other', place: r.place };
  }
}

/**
 * Firestore n'accepte aucune valeur `undefined` (même imbriquée) : les champs optionnels absents
 * sont omis plutôt qu'écrits à `undefined` (voir `omitUndefined`). Champs texte libres
 * (`referenceNumber`/`airline`/`flightNumber`/`company`) : garde `truthy` explicite plutôt que
 * `omitUndefined`, comportement d'origine conservé à l'identique — une chaîne vide reste omise
 * (pas juste `undefined`), contrairement aux champs `PlaceSummary`/numériques où les deux
 * checks sont équivalents.
 */
export function logisticToFb(r: Logistic): LogisticFirebase {
  const base = {
    id: r.id,
    title: r.title,
    notes: r.notes ?? '',
    files: r.files ?? [],
    links: r.links ?? [],
    booking: bookingToFb(r.booking),
    startDateTime: dateToFb(r.startDateTime),
    endDateTime: dateToFb(r.endDateTime),
    price: r.price ? priceToFb(r.price) : undefined,
    ...(r.referenceNumber ? { referenceNumber: r.referenceNumber } : {}),
  };

  switch (r.type) {
    case 'logement':
      return omitUndefined({ ...base, type: 'logement', place: r.place }) as LogisticFirebase;
    case 'flight':
      return {
        ...omitUndefined({
          ...base,
          type: 'flight',
          departureAirport: r.departureAirport,
          arrivalAirport: r.arrivalAirport,
          status: r.status ? flightStatusToFb(r.status) : undefined,
          statusFetchedAt: dateToFb(r.statusFetchedAt),
        }),
        ...(r.airline ? { airline: r.airline } : {}),
        ...(r.flightNumber ? { flightNumber: r.flightNumber } : {}),
      } as LogisticFirebase;
    case 'carRental':
      return {
        ...omitUndefined({ ...base, type: 'carRental', pickupPlace: r.pickupPlace, dropoffPlace: r.dropoffPlace }),
        ...(r.company ? { company: r.company } : {}),
      } as LogisticFirebase;
    case 'train':
      return omitUndefined({
        ...base,
        type: 'train',
        departurePlace: r.departurePlace,
        arrivalPlace: r.arrivalPlace,
      }) as LogisticFirebase;
    case 'other':
      return omitUndefined({ ...base, type: 'other', place: r.place }) as LogisticFirebase;
  }
}
