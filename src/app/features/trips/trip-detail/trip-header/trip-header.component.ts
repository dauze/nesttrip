import { ChangeDetectionStrategy, Component, computed, input, signal, viewChild } from '@angular/core';
import { format } from 'date-fns';
import { CardComponent } from '@app/shared/components/card/card.component';
import { MenuComponent } from '@app/shared/components/menu/menu.component';
import { TripSettingsSectionComponent } from '@app/features/trips/trip-settings-section/trip-settings-section.component';

/**
 * Header voyage épuré (ROADMAP.md, "Le trip header doit évoluer") : plage de
 * dates à gauche, avatars projetés à droite (`[trip-actions]`, voir
 * `TripSummaryComponent`), plus aucun champ éditable directement ici.
 *
 * Drawer "Voyage" séparé (ROADMAP.md "### UI", 2026-08-13 — remplace la
 * précédente section "Voyage" injectée dans le menu réglages global de la
 * roue crantée, `TripsComponent`) : ce composant monte désormais son PROPRE
 * `app-menu` local (`TripSettingsSectionComponent` projeté dedans, aucun
 * autre item), sans passer par un service pont (`AppSettingsMenuService`,
 * supprimé) — l'ancien besoin d'un pont ne s'appliquait qu'à l'ouverture du
 * menu global (monté plus haut dans l'arbre, dans `TripsComponent`) depuis ce
 * header (monté plus bas, uniquement dans l'onglet Résumé) ; le menu étant
 * maintenant local à CE composant, un simple `viewChild` suffit. Ouvert soit
 * par un clic sur la carte entière, soit par l'icône dédiée en fin de carte
 * (distincte de la roue crantée pour ne pas faire doublon visuel).
 *
 * `TripSettingsSectionComponent` n'est monté (`@if`, voir template) qu'une
 * fois le drawer ouvert au moins une fois (`settingsOpened`) — même principe
 * de montage paresseux que `visitedDays()` (`TripDaySwiperComponent`) : évite
 * de construire tout le graphe de dépendances de la section réglages (trip
 * facade, dialogs...) tant que l'utilisateur n'a jamais cliqué sur le header.
 */
@Component({
  selector: 'app-trip-header',
  standalone: true,
  imports: [CardComponent, MenuComponent, TripSettingsSectionComponent],
  templateUrl: './trip-header.component.html',
  styleUrl: './trip-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripHeaderComponent {
  readonly tripId = input.required<string>();
  /** Signal dédié (voir `TripFacade.getTripDateRange`/`TripStore._tripDays`), pas `activeTrip()` — évite un recalcul à chaque mutation du trip actif sans rapport avec les jours. */
  readonly dateRange = input<[Date, Date] | undefined>(undefined);

  private readonly settingsMenu = viewChild.required<MenuComponent>('settingsMenu');

  protected readonly settingsOpened = signal(false);

  readonly dateRangeLabel = computed(() => {
    const range = this.dateRange();
    if (!range) return '';
    const [start, end] = range;
    return `Voyage du ${format(start, 'dd/MM/yyyy')} au ${format(end, 'dd/MM/yyyy')}`;
  });

  protected onHeaderClick(event: Event): void {
    this.settingsOpened.set(true);
    this.settingsMenu().toggle(event);
  }
}
