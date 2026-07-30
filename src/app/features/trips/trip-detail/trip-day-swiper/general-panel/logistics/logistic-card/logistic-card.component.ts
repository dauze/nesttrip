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
import { LogisticHeaderComponent } from './logistic-header/logistic-header.component';
import { LogisticDetailsComponent } from './logistic-details/logistic-details.component';
import { LogisticFilesComponent } from '../logistic-files/logistic-files.component';
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
  selector: 'app-logistic-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass, PanelComponent, DividerComponent, CheckboxComponent,
    LogisticHeaderComponent, LogisticDetailsComponent, LogisticFilesComponent,
    SelectableDirective, LongPressDirective, TagComponent,
  ],
  templateUrl: './logistic-card.component.html',
  styleUrl: './logistic-card.component.scss',
})
export class LogisticCardComponent {
  private readonly tripFacade = inject(TripFacade);

  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');
  private readonly detailsComponent = viewChild.required<LogisticDetailsComponent>('details');

  readonly tripId = input.required<string>();
  readonly logisticId = input.required<string>();
  readonly initCollapsed = input.required<boolean>();

  readonly logistic = computed(() => this.tripFacade.getLogistic(this.logisticId())());

  readonly collapsed = linkedSignal(() => this.initCollapsed());

  readonly bookingMeta = computed(() => BOOKING_STATUS_META[this.logistic()?.booking?.status ?? BookingStatus.NOT_NEEDED]);

  /**
   * Catégorisation en cours/future/passée (voir ROADMAP.md, "Administratif") :
   * "passée" grise la carte, "en cours" affiche un tag — le cas par défaut
   * ("future") ne porte aucune marque visuelle particulière. "undated" :
   * date(s) pas encore renseignée(s) (voir ROADMAP.md "Devise" — jamais
   * préremplie à la création) — traité comme les activités non placées.
   */
  readonly timeStatus = computed<'past' | 'current' | 'future' | 'undated'>(() => {
    const logistic = this.logistic();
    if (!logistic) return 'future';
    if (!logistic.startDateTime || !logistic.endDateTime) return 'undated';
    const now = Date.now();
    if (logistic.endDateTime.getTime() < now) return 'past';
    if (logistic.startDateTime.getTime() <= now) return 'current';
    return 'future';
  });

  readonly selectableRef = computed<SelectableItemRef>(() => ({ kind: 'logistic', id: this.logisticId() }));

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }

  onTitleChanged(newTitle: string): void {
    const logistic = this.logistic();
    if (!logistic) return;
    this.tripFacade.updateLogistic(this.tripId(), { ...logistic, title: newTitle });
  }

  /** Mobile uniquement, déclenché juste après la création (voir LogisticsCreationService) : la carte démarre toujours repliée (`initCollapsed=true`), on la déplie d'abord pour que le chaînage guidé (LogisticDetailsComponent.startGuidedEntry) s'ancre correctement. */
  startGuidedEntry(): void {
    this.collapsed.set(false);
    setTimeout(() => this.detailsComponent().startGuidedEntry(), PANEL_EXPAND_DELAY_MS);
  }
}
