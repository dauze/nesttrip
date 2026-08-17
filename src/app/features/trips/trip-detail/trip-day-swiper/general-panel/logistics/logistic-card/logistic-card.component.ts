import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelComponent } from '@app/shared/components/layout/panel/panel.component';
import { DividerComponent } from '@app/shared/components/layout/divider/divider.component';
import { CheckboxComponent } from '@app/shared/components/form-fields/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectableItemRef } from '@app/shared/services/selection-mode.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { PlaceSummary } from '@core/models/place.dto';
import { LogisticDateTimeField } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META } from '../logistic.constants';
import { LogisticHeaderComponent } from './logistic-header/logistic-header.component';
import { LogisticDetailsComponent } from './logistic-details/logistic-details.component';
import { FilesFieldComponent, FileRef } from '@app/shared/components/form-fields/files-field/files-field.component';
import { TagComponent } from '@app/shared/components/feedback/tag/tag.component';

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
    LogisticHeaderComponent, LogisticDetailsComponent, FilesFieldComponent,
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

  /** Couleur d'identité du type (ROADMAP.md "### UI", uniformisation avec ActivityCardComponent) — remplace la couleur par statut de réservation sur le bord gauche de la carte, même mécanisme (dégradé pseudo-élément) que `.trip` dans activity-card.component.scss. */
  readonly typeColorVar = computed(() => LOGISTIC_TYPE_META[this.logistic()?.type ?? 'other'].colorVar);

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

  /** Chemin Storage des fichiers de cette réservation — préfixe SANS le nom de fichier final, voir `FilesFieldComponent.storagePathPrefix`. Une réservation est une entité plate (contrairement à l'activité), le chemin cible directement `logisticId()`. */
  protected readonly filesStoragePathPrefix = computed(() => `trips/${this.tripId()}/logistics/${this.logisticId()}`);

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }

  /** `(filesChange)` de `FilesFieldComponent` (ROADMAP.md "### UI", dédup avec ActivityCardComponent). */
  onFilesChange(files: FileRef[]): void {
    const logistic = this.logistic();
    if (!logistic) return;
    this.tripFacade.updateLogistic(this.tripId(), { ...logistic, files });
  }

  onTitleChanged(newTitle: string): void {
    const logistic = this.logistic();
    if (!logistic) return;
    this.tripFacade.updateLogistic(this.tripId(), { ...logistic, title: newTitle });
  }

  /** Logement uniquement (voir LogisticHeaderComponent.isLogement) : sélection Google faite via le dialog titre. */
  onHeaderPlaceSelected(place: PlaceSummary): void {
    const logistic = this.logistic();
    if (!logistic || logistic.type !== 'logement') return;
    this.tripFacade.updateLogistic(this.tripId(), { ...logistic, place });
  }

  /**
   * Déclenché juste après la création (voir `DayLogisticQuickAddService`/
   * `TripDetailComponent.logisticsAddMenuItems`, type toujours déjà connu à
   * ce stade) : la carte démarre toujours repliée (`initCollapsed=true`), on
   * la déplie d'abord pour que le chaînage guidé
   * (`LogisticDetailsComponent.startGuidedEntry`) s'ancre correctement.
   * Renvoie la promesse de fin de chaînage (voir
   * `LogisticsListComponent.focusCardWhenReady`, qui l'utilise pour revenir
   * sur le jour d'origine une fois la cinématique terminée).
   */
  startGuidedEntry(): Promise<void> {
    this.collapsed.set(false);
    return new Promise((resolve) => {
      setTimeout(() => this.detailsComponent().startGuidedEntry().then(resolve), PANEL_EXPAND_DELAY_MS);
    });
  }

  /** Clic sur une date/heure du header (voir LogisticHeaderComponent.dateTimeClicked, ROADMAP.md "UX / Interactions") : déplie la carte puis ouvre le picker correspondant du form. */
  onDateTimeClicked(field: LogisticDateTimeField): void {
    this.collapsed.set(false);
    setTimeout(() => {
      const details = this.detailsComponent();
      switch (field) {
        case 'startDate': details.openStartDate(); break;
        case 'startTime': details.openStartTime(); break;
        case 'endDate': details.openEndDate(); break;
        case 'endTime': details.openEndTime(); break;
      }
    }, PANEL_EXPAND_DELAY_MS);
  }
}
