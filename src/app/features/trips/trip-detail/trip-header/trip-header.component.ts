import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { format } from 'date-fns';
import { CardComponent } from '@app/shared/components/layout/card/card.component';
import { MenuComponent } from '@app/shared/components/overlays/menu/menu.component';
import { TripSettingsSectionComponent } from '@app/features/trips/trip-settings-section/trip-settings-section.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';

/**
 * Header voyage épuré (ROADMAP.md, "Le trip header doit évoluer") : destination
 * + plage de dates à gauche (et, en dessous, les noms des compagnons de route
 * — les avatars, eux, vivent désormais dans la toolbar app, voir
 * `TripCollaboratorsComponent`/`TripsComponent`), chevron d'ouverture à
 * droite, plus aucun champ éditable directement ici.
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
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();
  /** Signal dédié (voir `TripFacade.getTripDateRange`/`TripStore._tripDays`), pas `activeTrip()` — évite un recalcul à chaque mutation du trip actif sans rapport avec les jours. */
  readonly dateRange = input<[Date, Date] | undefined>(undefined);

  private readonly settingsMenu = viewChild.required<MenuComponent>('settingsMenu');

  protected readonly settingsOpened = signal(false);

  /** Destination principale (voir `TripFacade.getTripDestination`) — remplace le libellé fixe "Voyage" (retour utilisateur). */
  private readonly destination = computed(() => this.tripFacade.getTripDestination(this.tripId())());

  readonly dateRangeLabel = computed(() => {
    const range = this.dateRange();
    if (!range) return '';
    const [start, end] = range;
    const label = this.destination().ville || 'Voyage';
    return `${label} du ${format(start, 'dd/MM/yyyy')} au ${format(end, 'dd/MM/yyyy')}`;
  });

  /** Noms des compagnons de route (voir doc de classe) — les avatars sont désormais dans la toolbar app. */
  protected readonly companionNamesLabel = computed(() =>
    Object.values(this.tripFacade.getTripMembers(this.tripId())())
      .map((m) => m.displayName || m.email)
      .join(', '),
  );

  protected onHeaderClick(event: Event): void {
    this.settingsOpened.set(true);
    this.settingsMenu().toggle(event);
  }
}
