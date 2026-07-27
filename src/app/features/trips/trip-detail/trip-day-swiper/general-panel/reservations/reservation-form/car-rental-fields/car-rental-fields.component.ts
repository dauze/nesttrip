import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { PlaceSummary } from '@core/models/place.dto';
import { PlaceAutocompleteFieldComponent } from '../place-autocomplete-field/place-autocomplete-field.component';

@Component({
  selector: 'app-car-rental-fields',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextDirective, PlaceAutocompleteFieldComponent],
  templateUrl: './car-rental-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarRentalFieldsComponent {
  readonly form = input.required<FormGroup>();
  readonly initialPickupPlace = input<PlaceSummary | undefined>();
  readonly initialDropoffPlace = input<PlaceSummary | undefined>();

  readonly pickupPlaceSelected = output<PlaceSummary>();
  readonly dropoffPlaceSelected = output<PlaceSummary>();
}
