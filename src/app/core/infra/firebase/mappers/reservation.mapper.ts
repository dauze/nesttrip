import { BookingStatus } from '@core/enums/booking.status';
import { FlightStatus, Reservation } from '@core/models/reservation.dto';
import { FlightStatusFirebase, ReservationFirebase } from '../models/reservation.dto';
import { bookingFromFb, bookingToFb } from './activity.mapper';

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
    startDateTime: r.startDateTime ? new Date(Number(r.startDateTime)) : undefined,
    endDateTime: r.endDateTime ? new Date(Number(r.endDateTime)) : undefined,
    referenceNumber: r.referenceNumber,
    notes: r.notes ?? '',
    files: r.files ?? [],
    links: r.links ?? [],
    price: r.price,
    booking: r.booking ? bookingFromFb(r.booking) : { status: BookingStatus.NOT_NEEDED },
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
    notes: r.notes ?? '',
    files: r.files ?? [],
    links: r.links ?? [],
    booking: bookingToFb(r.booking),
    ...(r.startDateTime ? { startDateTime: String(r.startDateTime.getTime()) } : {}),
    ...(r.endDateTime ? { endDateTime: String(r.endDateTime.getTime()) } : {}),
    ...(r.referenceNumber ? { referenceNumber: r.referenceNumber } : {}),
    ...(r.price ? { price: r.price } : {}),
  };

  switch (r.type) {
    case 'hotel':
      return { ...base, type: 'hotel', ...(r.place ? { place: r.place } : {}) };
    case 'flight':
      return {
        ...base,
        type: 'flight',
        ...(r.airline ? { airline: r.airline } : {}),
        ...(r.flightNumber ? { flightNumber: r.flightNumber } : {}),
        ...(r.departureAirport ? { departureAirport: r.departureAirport } : {}),
        ...(r.arrivalAirport ? { arrivalAirport: r.arrivalAirport } : {}),
        ...(r.status ? { status: flightStatusToFb(r.status) } : {}),
        ...(r.statusFetchedAt ? { statusFetchedAt: String(r.statusFetchedAt.getTime()) } : {}),
      };
    case 'carRental':
      return {
        ...base,
        type: 'carRental',
        ...(r.company ? { company: r.company } : {}),
        ...(r.pickupPlace ? { pickupPlace: r.pickupPlace } : {}),
        ...(r.dropoffPlace ? { dropoffPlace: r.dropoffPlace } : {}),
      };
    case 'other':
      return {
        ...base,
        type: 'other',
        ...(r.place ? { place: r.place } : {}),
      };
  }
}
