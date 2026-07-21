import {
  ChangeDetectorRef, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject,
  input, linkedSignal, output, signal, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, filter, map, of, switchMap, take } from 'rxjs';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
// Remplacement des anciens modèles par PlaceDetails
import { LoadingState, PlaceSummary, PlaceDetails, PlacePhotoRef } from '@app/core/models/place.dto';
import { BookingStatus } from '@core/enums/booking.status';
import { ACTIVITY_TYPE_META, BOOKING_STATUS_META } from './activity.constants';
import { ActivityDispatchService, DraggedActivityInfo } from '@app/core/services/activity-dispatch.service';

import { ActivityHeaderComponent } from './activity-header/activity-header.component';
import { ActivityFilesComponent } from './activity-files/activity-files.component';
import { ActivityFormComponent } from './activity-form/activity-form.component';
import { ActivityGoogleInfoComponent } from './activity-google-info/activity-google-info.component';
import { Button } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';

/**
 * Délai de "hold" à respecter, poignée enfoncée sans bouger, avant de
 * considérer le geste comme un décrochage vers un autre jour plutôt qu'un
 * réordonnancement classique (voir `startDispatchGesture`). Volontairement
 * court : juste assez pour filtrer un simple clic/tap, sans faire attendre
 * l'utilisateur avant que le décrochage ne démarre.
 */
const HOLD_DELAY_MS = 20;
/** Laisse le temps à l'animation de repli du panneau de se terminer avant de décrocher la carte. */
const PANEL_COLLAPSE_DELAY_MS = 300;
/**
 * `[transitionOptions]` est dépréciée depuis PrimeNG 21 et n'est plus lue par
 * le composant (voir `computedMotionOptions` dans primeng-panel.mjs, qui ne
 * dépend plus que de `motionOptions`/`ptm('motion')`) — la fixer à '0ms'
 * n'avait donc plus AUCUN effet : le panneau continuait de replier avec
 * l'animation normale, d'où la carte encore dépliée capturée par le drag.
 * `[motionOptions]="{ duration: 0 }"` est le remplaçant qui fonctionne
 * réellement (voir `resolveDuration`/`el.style.transitionDuration` dans
 * primeng-motion.mjs).
 */
const INSTANT_PANEL_MOTION: { duration: number } = { duration: 0 };

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule, PanelModule, DividerModule, ProgressSpinnerModule, Button,
    ActivityHeaderComponent, ActivityFormComponent,
    ActivityFilesComponent, ActivityGoogleInfoComponent,
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly dispatchService = inject(ActivityDispatchService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');
  readonly initCollapsed = input.required<boolean>();
  readonly tripId = input.required<string>();
  /** Optionnel : absent quand l'activité n'est pas (encore) rattachée à un jour (vue générale). */
  readonly dayId = input<Date | undefined>(undefined);
  readonly activityId = input.required<string>();
  /** true uniquement pour les cartes rendues dans la liste réordonnable d'un jour (DayPanelComponent) — gouverne la désambiguïsation du geste dans `startDispatchGesture`. */
  readonly inDayList = input(false);

  readonly activity = computed(() => this.tripFacade.getActivity(this.activityId())());

  readonly bookingMeta = computed(() => {
    const status = this.activity()?.booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });

  readonly collapsed = linkedSignal(() => this.initCollapsed());;
  readonly scrollOffset = input(0);
  /** Piloté par `collapseInstantly()` : passe à une durée nulle le temps d'un repli forcé, pour ne jamais laisser le drag manuel capturer un état mi-animé. `undefined` = comportement/durée par défaut de PrimeNG. */
  protected readonly panelMotionOptions = signal<{ duration: number } | undefined>(undefined);

  /**
   * Émis dès le pointerdown sur la poignée quand `inDayList()` est vrai —
   * DayPanelComponent prend alors intégralement la main sur le geste
   * (collapse, suivi du pointeur, réordonnancement). Voir `startDispatchGesture`.
   */
  readonly dragHandleDown = output<{ x: number; y: number; pointerId: number; activityId: string }>();

  /** true pendant que cette carte est décrochée pour être déposée sur un autre jour. */
  readonly isBeingDragged = computed(() => this.dispatchService.isDraggedActivity(this.activityId()));
  /** true pendant le court instant où le "hold" est en cours d'évaluation. */
  readonly isPendingLift = computed(() => this.dispatchService.pendingActivityId() === this.activityId());

  private holdTimer?: ReturnType<typeof setTimeout>;
  /** Mémorise si le panneau était ouvert avant le décrochage, pour le rouvrir en cas d'annulation. */
  private wasExpandedBeforeLift = false;

  private readonly requestedPlaceId = signal<string>('');

  private readonly placeId$ = toObservable(this.requestedPlaceId).pipe(distinctUntilChanged());

  readonly detailsState = toSignal(
    this.placeId$.pipe(
      switchMap((id): ReturnType<typeof this.googlePlaceService.getPlaceDetails$> =>
        id ? this.googlePlaceService.getPlaceDetails$(id)
           : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlaceDetails> }
  );

  loadGoogleDetails(placeId: string): void {
    this.requestedPlaceId.set(placeId);
  }

  // --- Sélection d'un lieu depuis l'autocomplete + récupération des photos ---
  //
  // Historique du bug : l'ancienne implémentation faisait un `.subscribe()` manuel
  // avec `take(1)` directement sur `getPlacePhotos$`. Or ce flux est un état
  // (idle/loading/success/error), donc `take(1)` pouvait capturer l'état
  // "loading" au lieu de l'état final "success" selon le timing du cache -> les
  // photos étaient alors sauvegardées vides de façon aléatoire. De plus,
  // `activity` était capturé en closure au moment du clic, ce qui pouvait
  // écraser un état plus récent si l'activité changeait avant la résolution
  // de l'appel réseau.
  //
  // On repasse ici sur un signal + toObservable/switchMap, comme pour
  // `detailsState`, et on ne filtre que sur les états terminaux du flux photo.
  private readonly selectedPlace = signal<PlaceSummary | null>(null);

  private readonly selectedPlace$ = toObservable(this.selectedPlace).pipe(
    filter((place): place is PlaceSummary => !!place?.placeId)
  );

  constructor() {
    afterNextRender(() => {
      const el = this.cardContainer()?.nativeElement;
      if (!el) return;
      // passive:false est nécessaire ici pour pouvoir appeler preventDefault()
      // sur la poignée (sinon le navigateur sélectionne le texte alentour /
      // démarre son propre scroll tactile, voir updateDragState ci-dessous).
      el.addEventListener('pointerdown', this.updateDragState, { capture: true, passive: false });
      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.updateDragState, true);
        clearTimeout(this.holdTimer);
      });
    });

    // Une fois le "retour aimant" terminé pour cette activité, on rouvre le
    // panneau s'il était ouvert avant le décrochage.
    effect(() => {
      const returned = this.dispatchService.justReturned();
      if (returned && returned.activityId === this.activityId() && this.wasExpandedBeforeLift) {
        this.wasExpandedBeforeLift = false;
        this.collapsed.set(false);
      }
    });

    this.selectedPlace$
      .pipe(
        switchMap(place =>
          this.googlePlaceService.getPlacePhotos$(place.placeId).pipe(
            // On attend un état terminal (succès ou erreur), jamais "loading"/"idle".
            filter(state => state.status === 'success' || state.status === 'error'),
            take(1),
            map(state => ({
              place,
              photoRefs: state.status === 'success' && state.data?.photos
                ? state.data.photos.map((p: PlacePhotoRef) => p.name)
                : ([] as string[]),
            })),
            catchError(err => {
              console.error('Impossible de récupérer les photos du lieu à la sélection', err);
              return of({ place, photoRefs: [] as string[] });
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ place, photoRefs }) => {
        const activity = this.activity();
        if (!activity) return;

        this.tripFacade.updateActivity(this.tripId(), {
          ...activity,
          title: place.name,
          placeId: place.placeId,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          photoRefs,
        });
      });
  }

  /**
   * Replie la carte sans animation, pour que la géométrie finale soit peinte
   * dès la frame suivante — utilisé avant tout drag (pool ou jour) pour qu'un
   * déplacement immédiat, sans délai après le pointerdown, ne capture jamais
   * une carte encore (partiellement) dépliée.
   *
   * `detectChanges()` force ce rendu de façon synchrone plutôt que d'attendre
   * la détection de changements normale (asynchrone, après le déroulement
   * complet de l'événement) : DayPanelComponent lit la géométrie de la carte
   * juste après cet appel, dans le même geste. Voir `INSTANT_PANEL_MOTION`
   * pour pourquoi `motionOptions` (et pas l'ancienne `transitionOptions`) est
   * ce qui doit réellement être mis à zéro.
   */
  collapseInstantly(): void {
    this.panelMotionOptions.set(INSTANT_PANEL_MOTION);
    this.collapsed.set(true);
    this.cdr.detectChanges();
    requestAnimationFrame(() => this.panelMotionOptions.set(undefined));
  }

  openAndScroll(): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
      setTimeout(() => this.scrollToMe(), 300);
    } else {
      this.scrollToMe();
    }
  }

  onPlaceSelected(place: PlaceSummary): void {
    if (!place.placeId) return;
    this.selectedPlace.set(place);
  }

  onTitleChanged(newTitle: string): void {
    const activity = this.activity();
    if (!activity) return;

    this.tripFacade.updateActivity(this.tripId(), {
      ...activity,
      title: newTitle,
      placeId: '',
      address: '',
      latitude: 0,
      longitude: 0,
      photoRefs: [],
    });
  }

  private scrollToMe(): void {
    const element = this.cardContainer().nativeElement;
    const offset = this.scrollOffset();
    const y = window.scrollY + element.getBoundingClientRect().top - offset - 13;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      message: 'Supprimer cette activité ?',
      accept: () => this.tripFacade.removeActivity(this.tripId(), this.activityId(), this.dayId()),
    });
  }

  /**
   * Point d'entrée du geste, déclenché en phase de capture sur pointerdown,
   * pour garder le contrôle total sur qui possède le drag : notre mécanisme
   * de décrochage inter-jours (pool), ou le réordonnancement intra-jour piloté
   * par DayPanelComponent.
   */
  private updateDragState = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    const onHandle = !!target.closest('.drag-handle');
    if (!onHandle) return;

    // Empêche la sélection de texte et le scroll tactile natif que le
    // pointerdown sur la poignée déclencherait sinon (symptômes observés :
    // texte sélectionné sous le doigt, interface qui reste "en drag" après
    // le relâchement).
    event.preventDefault();

    this.startDispatchGesture(event.clientX, event.clientY, event.pointerId);
  };

  /**
   * Désambiguïsation reorder / décrochage inter-jours :
   * - Dans un jour (`inDayList()`) : DayPanelComponent est TOUJOURS seul
   *   maître du geste dès le pointerdown — plus aucune compétition avec un
   *   "hold". C'est l'overlay qui décide, en survolant sa barre repliée assez
   *   longtemps, d'escalader ce drag en cours vers le calendrier (voir
   *   ActivityDayDispatchOverlayComponent).
   * - Dans le pool général : exigence de "hold" inchangée, pour qu'un simple
   *   tap/clic sur la poignée ne déclenche jamais le décrochage.
   */
  private startDispatchGesture(x: number, y: number, pointerId: number): void {
    this.clearHoldTimer();

    if (this.inDayList()) {
      this.dragHandleDown.emit({ x, y, pointerId, activityId: this.activityId() });
      return;
    }

    this.dispatchService.setPending(this.activityId());

    const cancelHold = () => {
      document.removeEventListener('mouseup', cancelHold, true);
      document.removeEventListener('touchend', cancelHold, true);
      this.clearHoldTimer();
    };
    document.addEventListener('mouseup', cancelHold, true);
    document.addEventListener('touchend', cancelHold, true);

    this.holdTimer = setTimeout(() => {
      document.removeEventListener('mouseup', cancelHold, true);
      document.removeEventListener('touchend', cancelHold, true);
      this.holdTimer = undefined;
      this.dispatchService.clearPending();
      this.beginLift(x, y);
    }, HOLD_DELAY_MS);
  }

  /** Construit l'info de drag pour cette carte, à l'usage de DayPanelComponent au démarrage d'un réordonnancement intra-jour (voir `registerActiveDayDrag`). */
  buildDayDragInfo(): DraggedActivityInfo | null {
    return this.buildDraggedInfo(this.element);
  }

  private buildDraggedInfo(el: HTMLElement): DraggedActivityInfo | null {
    const activity = this.activity();
    if (!activity) return null;
    return {
      tripId: this.tripId(),
      activityId: this.activityId(),
      sourceDayId: this.dayId(),
      title: activity.title || 'Sans titre',
      icon: ACTIVITY_TYPE_META[activity.type]?.icon ?? 'pi pi-bolt',
      color: this.resolveRingColor(el),
      photoRef: activity.photoRefs?.[0],
      origin: this.inDayList() ? 'day' : 'pool',
    };
  }

  private clearHoldTimer(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = undefined;
    }
    this.dispatchService.clearPending();
  }

  /**
   * Décroche la carte. Si le panneau était ouvert, on le referme d'abord et on
   * attend la fin de son animation avant de faire apparaître la boule — MAIS
   * si l'utilisateur relâche le doigt pendant cette attente (il n'a donc pas
   * réellement fait de drag), on annule tout et on rouvre immédiatement :
   * sans ce garde-fou, le geste reste "orphelin" (le panneau reste fermé et
   * la boule finit par apparaître seule, sans qu'aucun pointerup ne puisse
   * plus jamais la récupérer).
   */
  private beginLift(x: number, y: number): void {
    const activity = this.activity();
    const el = this.cardContainer()?.nativeElement;
    if (!activity || !el) return;

    this.wasExpandedBeforeLift = !this.collapsed();

    const info = this.buildDraggedInfo(el);
    if (!info) return;

    if (!this.wasExpandedBeforeLift) {
      this.dispatchService.beginLift(info, el.getBoundingClientRect(), x, y);
      return;
    }

    this.collapsed.set(true);

    let released = false;
    const onEarlyRelease = () => {
      released = true;
      document.removeEventListener('pointerup', onEarlyRelease, true);
      document.removeEventListener('pointercancel', onEarlyRelease, true);
    };
    document.addEventListener('pointerup', onEarlyRelease, true);
    document.addEventListener('pointercancel', onEarlyRelease, true);

    setTimeout(() => {
      document.removeEventListener('pointerup', onEarlyRelease, true);
      document.removeEventListener('pointercancel', onEarlyRelease, true);

      if (released) {
        // Relâché avant même la formation de la boule : rien ne s'est
        // "vraiment" passé, on rouvre juste le panneau qu'on avait fermé.
        this.wasExpandedBeforeLift = false;
        this.collapsed.set(false);
        return;
      }

      this.dispatchService.beginLift(info, el.getBoundingClientRect(), x, y);
    }, PANEL_COLLAPSE_DELAY_MS);
  }

  private resolveRingColor(el: HTMLElement): string {
    const panelEl = el.querySelector('.p-panel') as HTMLElement | null;
    const value = getComputedStyle(panelEl ?? el).getPropertyValue('--booking-status-color').trim();
    return value || 'var(--p-primary-color)';
  }

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }

  /** Le vrai élément hôte `<app-activity-card>` — le flex-item dont DayPanelComponent lit la géométrie et qu'il retire du flux pendant un drag (voir `leaveFlowHidden`). */
  get hostElement(): HTMLElement {
    return this.hostRef.nativeElement;
  }

  /**
   * Retire la carte du flux (position:absolute) et la masque, SANS jamais la
   * déplacer dans le DOM (ni reparenting, ni `display:none`) — DayPanelComponent
   * fait suivre le doigt à un CLONE séparé pendant ce temps (voir
   * `beginCardFollow`/`cloneEl`). Reparenter le VRAI nœud (une version
   * précédente le faisait, pour échapper au `transform`/`filter` du swiper qui
   * casse `position:fixed`) fait annuler le geste par le navigateur
   * (`pointercancel`) au moindre mouvement sur beaucoup de
   * navigateurs/plateformes, puisque ce nœud est la cible du pointeur actif.
   */
  leaveFlowHidden(): void {
    const style = this.hostRef.nativeElement.style;
    style.position = 'absolute';
    style.visibility = 'hidden';
    style.pointerEvents = 'none';
  }

  /** Annule `leaveFlowHidden()` : la carte reprend sa place normale dans le flux. */
  rejoinFlow(): void {
    const style = this.hostRef.nativeElement.style;
    style.position = '';
    style.visibility = '';
    style.pointerEvents = '';
  }

  /**
   * Décale visuellement cette carte (voisine de la carte draguée, jamais
   * elle-même) pour ouvrir/refermer la place laissée par le réordonnancement
   * en cours — voir DayPanelComponent.applySiblingOffsets. Une simple
   * transition CSS déclarative suffit ici (contrairement à `settleCard`) :
   * un décalage uniforme d'une carte encore collapsée n'a pas besoin de FLIP.
   */
  setShiftOffset(px: number): void {
    const style = this.hostRef.nativeElement.style;
    style.transition = 'transform 200ms ease';
    style.transform = px ? `translateY(${px}px)` : '';
  }

  /** Annule `setShiftOffset`. */
  clearShiftOffset(): void {
    const style = this.hostRef.nativeElement.style;
    style.transition = '';
    style.transform = '';
  }
}