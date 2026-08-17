import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CardComponent } from '@app/shared/components/layout/card/card.component';
import { ChipComponent } from '@app/shared/components/feedback/chip/chip.component';
import { fileIcon, openFile } from '@app/shared/utils/file-icon';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { computeFileGroups, FileGroup } from './trip-files-tile.util';

interface PlacedActivity {
  dayId: Date;
  activity: Activity;
}

/**
 * Tuile "Fichiers" (onglet Résumé, ex-tuile "Résumé" — voir ROADMAP.md "UX /
 * Interactions") : liste, groupés par activité/réservation d'origine, tous
 * les fichiers joints du trip — activités d'abord (ordre chronologique des
 * jours, déjà celui de `placedActivities`), puis réservations logistiques
 * (`TripFacade.allLogisticsSorted`, même ordre que l'onglet Logistique en
 * tri "Chronologie"). Une activité posée sur plusieurs jours ne doit
 * apparaître qu'UNE fois (voir `computeFileGroups`/CLAUDE.md "Pool léger +
 * instances par jour"). Clic sur un fichier : l'ouvre dans un nouvel onglet
 * (`fileIcon`/`openFile`, mêmes utilitaires que `FilesFieldComponent`).
 */
@Component({
  selector: 'app-trip-files-tile',
  standalone: true,
  imports: [CardComponent, ChipComponent],
  templateUrl: './trip-files-tile.component.html',
  styleUrl: './trip-files-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripFilesTileComponent {
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();
  readonly placedActivities = input.required<PlacedActivity[]>();

  protected readonly fileIcon = fileIcon;
  protected readonly openFile = openFile;

  readonly fileGroups = computed<FileGroup[]>(() =>
    computeFileGroups(this.placedActivities(), this.tripFacade.allLogisticsSorted(this.tripId())),
  );
}
