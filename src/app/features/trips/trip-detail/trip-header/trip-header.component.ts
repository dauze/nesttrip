import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { format } from 'date-fns';
import { CardComponent } from '@app/shared/components/card/card.component';
import { AppSettingsMenuService } from '@app/core/services/app-settings-menu.service';

/**
 * Header voyage épuré (ROADMAP.md, "Le trip header doit évoluer") : plage de
 * dates à gauche, avatars projetés à droite (`[trip-actions]`, voir
 * `TripSummaryComponent`), plus aucun champ éditable directement ici — toute
 * l'édition (titre, dates, participants, paliers de trajet, suppression) vit
 * désormais dans la section "Voyage" du menu réglages (roue crantée,
 * `TripsComponent`/`TripSettingsSectionComponent`). Un clic n'importe où sur
 * ce header ouvre ce même menu (`AppSettingsMenuService.requestOpen`), au lieu
 * d'ouvrir un dialog directement : ce composant n'est monté que dans l'onglet
 * Résumé, alors que le menu réglages doit rester utilisable depuis n'importe
 * quel onglet du voyage.
 */
@Component({
  selector: 'app-trip-header',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './trip-header.component.html',
  styleUrl: './trip-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripHeaderComponent {
  private readonly appSettingsMenuService = inject(AppSettingsMenuService);

  /** Signal dédié (voir `TripFacade.getTripDateRange`/`TripStore._tripDays`), pas `activeTrip()` — évite un recalcul à chaque mutation du trip actif sans rapport avec les jours. */
  readonly dateRange = input<[Date, Date] | undefined>(undefined);

  readonly dateRangeLabel = computed(() => {
    const range = this.dateRange();
    if (!range) return '';
    const [start, end] = range;
    return `Voyage du ${format(start, 'dd/MM/yyyy')} au ${format(end, 'dd/MM/yyyy')}`;
  });

  protected onHeaderClick(): void {
    this.appSettingsMenuService.requestOpen();
  }
}
