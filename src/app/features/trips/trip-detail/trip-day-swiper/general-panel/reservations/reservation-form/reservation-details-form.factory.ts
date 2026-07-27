import { FormBuilder, FormGroup } from '@angular/forms';
import { ReservationType } from '@core/models/reservation.dto';

/**
 * Reconstruit le bout de formulaire propre à un type de réservation. Les
 * champs "lieu" (place/departureAirport/arrivalAirport/pickupPlace/dropoffPlace)
 * n'y figurent volontairement PAS : `AutoCompleteComponent` n'accepte qu'une
 * valeur texte libre (voir PlaceAutocompleteFieldComponent), les objets
 * `PlaceSummary` sélectionnés sont conservés à part par `ReservationFormComponent`
 * et mergés à la sauvegarde — seuls les champs texte simples vivent ici.
 */
export function buildDetailsForm(fb: FormBuilder, type: ReservationType): FormGroup {
  switch (type) {
    case 'hotel':
      return fb.group({});
    case 'flight':
      return fb.group({
        airline: fb.nonNullable.control<string>(''),
        flightNumber: fb.nonNullable.control<string>(''),
      });
    case 'carRental':
      return fb.group({
        company: fb.nonNullable.control<string>(''),
      });
    case 'other':
      return fb.group({});
  }
}
