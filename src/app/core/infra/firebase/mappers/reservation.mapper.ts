import { FlightStatus, Reservation } from '@core/models/reservation.dto';
import { FlightStatusFirebase, ReservationFirebase } from '../models/reservation.dto';

function flightStatusFromFb(s: FlightStatusFirebase): FlightStatus {
  return {
    ...s,
    actualDepartureTime: s.actualDepartureTime ? new Date(Number(s.actualDepartureTime)) : undefined,
    actualArrivalTime: s.actualArrivalTime ? new Date(Number(s.actualArrivalTime)) : undefined,
  };
}

export function flightStatusToFb(s: FlightStatus): FlightStatusFirebase {
  return {
    ...s,
    actualDepartureTime: s.actualDepartureTime ? String(s.actualDepartureTime.getTime()) : '',
    actualArrivalTime: s.actualArrivalTime ? String(s.actualArrivalTime.getTime()) : '',
  };
}

export function reservationFromFb(r: ReservationFirebase): Reservation {
  const base = {
    id: r.id,
    title: r.title,
    startDateTime: new Date(Number(r.startDateTime)),
    endDateTime: new Date(Number(r.endDateTime)),
    referenceNumber: r.referenceNumber,
    notes: r.notes ?? '',
    files: r.files ?? [],
    links: r.links ?? [],
    price: r.price,
  };

  switch (r.type) {
    case 'hotel':
      return { ...base, type: 'hotel', place: r.place };
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
    case 'other':
      return { ...base, type: 'other', place: r.place };
  }
}

/** Firestore n'accepte aucune valeur `undefined` (même imbriquée) : les champs optionnels absents sont omis plutôt qu'écrits à `undefined`. */
export function reservationToFb(r: Reservation): ReservationFirebase {
  const base = {
    id: r.id,
    title: r.title,
    startDateTime: String(r.startDateTime.getTime()),
    endDateTime: String(r.endDateTime.getTime()),
    notes: r.notes ?? '',
    files: r.files ?? [],
    links: r.links ?? [],
    ...(r.referenceNumber ? { referenceNumber: r.referenceNumber } : {}),
    ...(r.price ? { price: r.price } : {}),
  };

  switch (r.type) {
    case 'hotel':
      return { ...base, type: 'hotel', place: r.place };
    case 'flight':
      return {
        ...base,
        type: 'flight',
        airline: r.airline,
        flightNumber: r.flightNumber,
        departureAirport: r.departureAirport,
        arrivalAirport: r.arrivalAirport,
        ...(r.status ? { status: flightStatusToFb(r.status) } : {}),
        ...(r.statusFetchedAt ? { statusFetchedAt: String(r.statusFetchedAt.getTime()) } : {}),
      };
    case 'carRental':
      return {
        ...base,
        type: 'carRental',
        company: r.company,
        pickupPlace: r.pickupPlace,
        dropoffPlace: r.dropoffPlace,
      };
    case 'other':
      return {
        ...base,
        type: 'other',
        ...(r.place ? { place: r.place } : {}),
      };
  }
}
