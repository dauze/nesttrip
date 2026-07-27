import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { PlaceSummary } from '@core/models/place.dto';
import { PlaceAutocompleteFieldComponent } from '../place-autocomplete-field/place-autocomplete-field.component';

@Component({
  selector: 'app-flight-fields',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextDirective, PlaceAutocompleteFieldComponent],
  templateUrl: './flight-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightFieldsComponent {
  readonly form = input.required<FormGroup>();
  readonly initialDepartureAirport = input<PlaceSummary | undefined>();
  readonly initialArrivalAirport = input<PlaceSummary | undefined>();

  readonly departureAirportSelected = output<PlaceSummary>();
  readonly arrivalAirportSelected = output<PlaceSummary>();
}
