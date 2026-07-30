import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlaceSummary } from '@core/models/place.dto';
import { PlaceAutocompleteFieldComponent } from '../place-autocomplete-field/place-autocomplete-field.component';

/** Champs "lieu" d'une location de voiture — le champ texte (loueur) vit directement dans `LogisticDetailsComponent` (form plat unique). */
@Component({
  selector: 'app-car-rental-fields',
  standalone: true,
  imports: [PlaceAutocompleteFieldComponent],
  templateUrl: './car-rental-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarRentalFieldsComponent {
  readonly initialPickupPlace = input<PlaceSummary | undefined>();
  readonly initialDropoffPlace = input<PlaceSummary | undefined>();

  readonly pickupPlaceSelected = output<PlaceSummary>();
  readonly dropoffPlaceSelected = output<PlaceSummary>();
}
