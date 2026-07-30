import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlaceSummary } from '@core/models/place.dto';
import { PlaceAutocompleteFieldComponent } from '../place-autocomplete-field/place-autocomplete-field.component';

/** Champs "lieu" d'un vol (aéroports) — les champs texte (compagnie, n° de vol) vivent directement dans `LogisticDetailsComponent` (form plat unique). */
@Component({
  selector: 'app-flight-fields',
  standalone: true,
  imports: [PlaceAutocompleteFieldComponent],
  templateUrl: './flight-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightFieldsComponent {
  readonly initialDepartureAirport = input<PlaceSummary | undefined>();
  readonly initialArrivalAirport = input<PlaceSummary | undefined>();

  readonly departureAirportSelected = output<PlaceSummary>();
  readonly arrivalAirportSelected = output<PlaceSummary>();
}
