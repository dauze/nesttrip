import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectableItemRef } from '@app/shared/services/selection-mode.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { BOOKING_STATUS_META } from '@app/shared/components/activity-card/activity.constants';
import { ReservationHeaderComponent } from './reservation-header/reservation-header.component';
import { ReservationDetailsComponent } from './reservation-details/reservation-details.component';
import { ReservationFilesComponent } from '../reservation-files/reservation-files.component';
import { TagComponent } from '@app/shared/components/tag/tag.component';

/** Laisse le temps à l'animation de dépli du panneau de se terminer avant de lancer le chaînage guidé (voir `startGuidedEntry`) — sinon les panneaux/dialogs CDK s'ancrent à un élément encore en cours de transition (`max-height`). Même valeur que `PANEL_COLLAPSE_DELAY_MS` dans ActivityCardComponent. */
const PANEL_EXPAND_DELAY_MS = 300;

/**
 * Carte réservation dépliable — même structure que `ActivityCardComponent`
 * (panel + header éditable + corps + fichiers), sans aucune des mécaniques
 * de drag-and-drop pool/jour (une réservation est une entité plate,
 * indépendante des jours, jamais dispatchée).
 */
@Component({
  selector: 'app-reservation-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass, PanelComponent, DividerComponent, CheckboxComponent,
    ReservationHeaderComponent, ReservationDetailsComponent, ReservationFilesComponent,
    SelectableDirective, LongPressDirective, TagComponent,
  ],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent {
  private readonly tripFacade = inject(TripFacade);

  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');
  private readonly detailsComponent = viewChild.required<ReservationDetailsComponent>('details');

  readonly tripId = input.required<string>();
  readonly reservationId = input.required<string>();
  readonly initCollapsed = input.required<boolean>();

  readonly reservation = computed(() => this.tripFacade.getReservation(this.reservationId())());

  readonly collapsed = linkedSignal(() => this.initCollapsed());

  readonly bookingMeta = computed(() => BOOKING_STATUS_META[this.reservation()?.booking?.status ?? BookingStatus.NOT_NEEDED]);

  /**
   * Catégorisation en cours/future/passée (voir ROADMAP.md, "Administratif") :
   * "passée" grise la carte, "en cours" affiche un tag — le cas par défaut
   * ("future") ne porte aucune marque visuelle particulière. "undated" :
   * date(s) pas encore renseignée(s) (voir ROADMAP.md "Devise" — jamais
   * préremplie à la création) — traité comme les activités non placées.
   */
  readonly timeStatus = computed<'past' | 'current' | 'future' | 'undated'>(() => {
    const reservation = this.reservation();
    if (!reservation) return 'future';
    if (!reservation.startDateTime || !reservation.endDateTime) return 'undated';
    const now = Date.now();
    if (reservation.endDateTime.getTime() < now) return 'past';
    if (reservation.startDateTime.getTime() <= now) return 'current';
    return 'future';
  });

  readonly selectableRef = computed<SelectableItemRef>(() => ({ kind: 'reservation', id: this.reservationId() }));

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }

  onTitleChanged(newTitle: string): void {
    const reservation = this.reservation();
    if (!reservation) return;
    this.tripFacade.updateReservation(this.tripId(), { ...reservation, title: newTitle });
  }

  /** Mobile uniquement, déclenché juste après la création (voir ReservationsCreationService) : la carte démarre toujours repliée (`initCollapsed=true`), on la déplie d'abord pour que le chaînage guidé (ReservationDetailsComponent.startGuidedEntry) s'ancre correctement. */
  startGuidedEntry(): void {
    this.collapsed.set(false);
    setTimeout(() => this.detailsComponent().startGuidedEntry(), PANEL_EXPAND_DELAY_MS);
  }
}
