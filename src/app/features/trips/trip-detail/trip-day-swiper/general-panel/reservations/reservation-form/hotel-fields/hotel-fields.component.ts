import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlaceSummary } from '@core/models/place.dto';
import { PlaceAutocompleteFieldComponent } from '../place-autocomplete-field/place-autocomplete-field.component';

@Component({
  selector: 'app-hotel-fields',
  standalone: true,
  imports: [PlaceAutocompleteFieldComponent],
  templateUrl: './hotel-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HotelFieldsComponent {
  readonly initialPlace = input<PlaceSummary | undefined>();
  readonly placeSelected = output<PlaceSummary>();
}
