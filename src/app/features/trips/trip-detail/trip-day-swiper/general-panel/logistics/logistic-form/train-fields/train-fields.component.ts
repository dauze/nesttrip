import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlaceSummary } from '@core/models/place.dto';
import { PlaceAutocompleteFieldComponent } from '../place-autocomplete-field/place-autocomplete-field.component';
import { DividerComponent } from '@app/shared/components/layout/divider/divider.component';

/** Champs "lieu" d'un train (villes de départ/arrivée) — mêmes principes que `CarRentalFieldsComponent`/`FlightFieldsComponent`. */
@Component({
  selector: 'app-train-fields',
  standalone: true,
  imports: [PlaceAutocompleteFieldComponent, DividerComponent],
  templateUrl: './train-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainFieldsComponent {
  readonly initialDeparturePlace = input<PlaceSummary | undefined>();
  readonly initialArrivalPlace = input<PlaceSummary | undefined>();

  readonly departurePlaceSelected = output<PlaceSummary>();
  readonly arrivalPlaceSelected = output<PlaceSummary>();
}
