import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { GooglePlaceService } from '@core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@core/models/place.dto';
import { Reservation } from '@core/models/reservation.dto';
import { RESERVATION_TYPE_META } from '../../reservation.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';

/**
 * Header d'une carte réservation : icône du type + titre éditable — même
 * mécanisme que `ActivityHeaderComponent` (desktop : autocomplete Google
 * inline ; mobile : texte statique + crayon ouvrant `TitleEditDialogComponent`
 * en tiroir plein écran, réutilisé tel quel). Contrairement à l'activité, un
 * lieu choisi ici ne renseigne QUE le titre (texte) : l'objet `PlaceSummary`
 * du champ "adresse" propre au type (hôtel/aéroports/agences) se choisit à
 * part, dans le corps déplié de la carte (voir `ReservationDetailsComponent`).
 */
@Component({
  selector: 'app-reservation-header',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, AutoCompleteComponent],
  templateUrl: './reservation-header.component.html',
  styleUrl: './reservation-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationHeaderComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);
  protected readonly viewport = inject(ViewportService);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly reservation = input.required<Reservation>();
  readonly titleEdited = output<string>();

  readonly typeMeta = RESERVATION_TYPE_META;

  private readonly searchTerm = signal('');
  private readonly searchState = toSignal(
    this.googlePlaceService.search$(toObservable(this.searchTerm)),
    { initialValue: { status: 'idle' } as LoadingState<PlaceSummary[]> },
  );

  readonly places = computed(() => {
    const s = this.searchState();
    return s.status === 'success' ? s.data : [];
  });
  readonly searching = computed(() => this.searchState().status === 'loading');

  readonly titleControl = new FormControl('', { nonNullable: true });

  constructor() {
    runOnceReady(this.reservation, (r) => this.titleControl.setValue(r.title, { emitEvent: false }));
  }

  onSearch(query: string): void {
    this.searchTerm.set(query ?? '');
  }

  onSelect(raw: PlaceSummary): void {
    if (!raw?.placeId) return;
    const name = this.extractPlaceName(raw.name);
    this.titleControl.setValue(name);
    this.titleEdited.emit(name);
  }

  displayName = (place: { name: unknown }): string => this.extractPlaceName(place?.name);

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }

  onTitleBlur(): void {
    const next = this.titleControl.value;
    const trimmed = next.trim();
    if (this.reservation().title === trimmed) return;
    this.titleEdited.emit(trimmed);
  }

  /** Mobile uniquement (voir le template) — même dialog que `ActivityHeaderComponent`. */
  openTitleEditDialog(event: MouseEvent): void {
    event.stopPropagation();

    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: this.reservation().title },
        panelClass: 'app-title-edit-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (!result) return;

      if (result.type === 'place') {
        this.onSelect(result.place);
        return;
      }

      const trimmed = result.text.trim();
      this.titleControl.setValue(trimmed);
      if (this.reservation().title === trimmed) return;
      this.titleEdited.emit(trimmed);
    });
  }
}
