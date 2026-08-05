import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap } from 'rxjs';
import { TagComponent } from '@app/shared/components/tag/tag.component';
import { PanelComponent, PanelToggleEvent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { GooglePlaceService } from '@core/services/google-place.service';
import { LoadingState, PlaceDetails, PlaceSummary } from '@core/models/place.dto';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/**
 * Bloc "adresse + lien Google Maps + infos détaillées" — copie générique de
 * `ActivityGoogleInfoComponent` prenant directement un `PlaceSummary` plutôt
 * qu'une `Activity` entière : une réservation peut avoir plusieurs champs
 * "lieu" en même temps (aéroports de départ/arrivée, prise en charge/
 * restitution), chacun affiche donc sa propre instance, gérant elle-même son
 * fetch de détails (contrairement à l'activité, où ce fetch est orchestré au
 * niveau de la carte — inutile ici vu qu'il n'y a jamais qu'un seul lieu par
 * instance de ce composant).
 */
@Component({
  selector: 'app-logistic-place-info',
  standalone: true,
  imports: [CommonModule, TagComponent, PanelComponent, DividerComponent],
  templateUrl: './logistic-place-info.component.html',
  styleUrl: './logistic-place-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogisticPlaceInfoComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);

  readonly place = input<PlaceSummary | undefined>(undefined);
  /** Jour de référence pour "ouvert maintenant" — défaut à aujourd'hui si absent (une réservation n'est pas rattachée à un jour précis). */
  readonly referenceDate = input<Date | undefined>(undefined);
  /**
   * `false` uniquement pour l'usage "logement" de `LogisticDetailsComponent`
   * (ROADMAP.md "Bugs / fixes", retour utilisateur : "2 séparateurs collés
   * entre Résa et info Google") : ce composant est le SEUL contenu du bloc
   * "champs propres au type" pour ce type (pas de champ "adresse" séparé, le
   * lieu se choisit via le titre) — le `<app-divider>` déjà rendu par le
   * PARENT juste avant ce bloc suffit, une 2e ici serait collée à la
   * première. Partout ailleurs (aéroports, lieux de prise en charge/
   * restitution, gares...), ce composant suit toujours un VRAI champ de
   * recherche, jamais directement un autre `<app-divider>` : son propre
   * séparateur reste donc nécessaire par défaut (`true`).
   */
  readonly showLeadingDivider = input(true);

  private readonly requestedPlaceId = signal<string>('');
  private readonly placeId$ = toObservable(this.requestedPlaceId).pipe(distinctUntilChanged());

  private readonly detailsState = toSignal(
    this.placeId$.pipe(
      switchMap((id): ReturnType<typeof this.googlePlaceService.getPlaceDetails$> =>
        id ? this.googlePlaceService.getPlaceDetails$(id) : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlaceDetails> }
  );

  readonly details = computed(() => {
    const s = this.detailsState();
    return s.status === 'success' ? s.data : null;
  });

  readonly detailsLoading = computed(() => this.detailsState().status === 'loading');
  readonly isVisible = computed(() => !!this.place()?.placeId);

  readonly mapsUrl = computed(() => {
    const place = this.place();
    if (!place?.placeId) return null;
    const query = encodeURIComponent(place.address || place.name);
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${place.placeId}`;
  });

  readonly todayDayName = computed(() => DAY_NAMES[(this.referenceDate() ?? new Date()).getDay()]);

  readonly isOpenNow = computed(() => {
    const hours = this.details()?.openingHours;
    if (!hours?.length) return null;

    const day = this.referenceDate() ?? new Date();
    const now = new Date();
    const checkTime = new Date(day);
    checkTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const todayName = DAY_NAMES[checkTime.getDay()];
    const todayLine = hours.find((h) => h.toLowerCase().startsWith(todayName));
    if (!todayLine) return false;
    if (todayLine.toLowerCase().includes('fermé')) return false;

    const ranges = [...todayLine.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)];
    const hm = checkTime.getHours() * 60 + checkTime.getMinutes();

    return ranges.some(([, sh, sm, eh, em]) => {
      const start = +sh * 60 + +sm;
      let end = +eh * 60 + +em;
      if (end < start) end += 24 * 60;
      return hm >= start && hm <= end;
    });
  });

  onPanelToggle(event: PanelToggleEvent): void {
    if (!event.collapsed) return;

    const placeId = this.place()?.placeId;
    if (placeId) this.requestedPlaceId.set(placeId);
  }

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }
}
