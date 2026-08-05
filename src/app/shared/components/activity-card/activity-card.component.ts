import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject,
  input, linkedSignal, output, signal, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, filter, map, of, switchMap, take } from 'rxjs';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
// Remplacement des anciens modèles par PlaceDetails
import { LoadingState, PlaceSummary, PlaceDetails, PlacePhotoRef } from '@app/core/models/place.dto';
import { ActivityType } from '@core/enums/activites-type.enum';
import { ACTIVITY_TYPE_META } from './activity.constants';
import { ActivityDispatchService, DraggedActivityInfo } from '@app/core/services/activity-dispatch.service';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';

import { ActivityHeaderComponent } from './activity-header/activity-header.component';
import { FilesFieldComponent, FileRef } from '@app/shared/components/files-field/files-field.component';
import { ActivityFormComponent } from './activity-form/activity-form.component';
import { ActivityGoogleInfoComponent } from './activity-google-info/activity-google-info.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectableItemRef } from '@app/shared/services/selection-mode.service';

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
/** Laisse le temps à l'animation de dépli du panneau de se terminer avant d'ouvrir un éditeur du form (voir `openStartTime`) — même valeur que `PANEL_EXPAND_DELAY_MS` dans LogisticCardComponent. */
const PANEL_EXPAND_DELAY_MS = 300;

@Component({
  selector: 'app-activity-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, PanelComponent, DividerComponent, CheckboxComponent,
    ActivityHeaderComponent, ActivityFormComponent,
    FilesFieldComponent, ActivityGoogleInfoComponent,
    SelectableDirective, LongPressDirective,
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly dispatchService = inject(ActivityDispatchService);
  // Optionnel : fourni par TripDaySwiperComponent (ancêtre commun aux vues
  // jour ET pool général, qui vit elle aussi dans un swiper-slide — voir
  // isBeingDragged ci-dessous) ; `null` si ce composant est un jour utilisé
  // hors de ce contexte.
  private readonly swiperLockService = inject(SwiperLockService, { optional: true });
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');
  readonly initCollapsed = input.required<boolean>();
  readonly tripId = input.required<string>();
  /** Optionnel : absent quand l'activité n'est pas (encore) rattachée à un jour (vue générale). */
  readonly dayId = input<Date | undefined>(undefined);
  readonly activityId = input.required<string>();
  /**
   * true uniquement pour les cartes rendues dans la liste réordonnable d'un
   * jour (DayPanelComponent) — gouverne la désambiguïsation du geste dans
   * `startDispatchGesture`, ET (voir le template) si le form d'édition
   * (`app-activity-form`) est monté. `dayId()` seul ne suffit pas pour cette
   * 2e décision : TripActivitiesComponent (onglet Activités, tri
   * chronologique) passe aussi `dayId` — nécessaire pour résoudre la bonne
   * instance via `getDayActivity` — sans pour autant vouloir un form éditable
   * inline dans cette vue d'ensemble en lecture (voir ROADMAP.md, "le détail
   * était affiché à tort en mode chronologie").
   */
  readonly inDayList = input(false);
  /**
   * Fourni uniquement par TripActivitiesComponent pour une carte "représentante"
   * d'un groupe de doublons de même placeId (vue Ville) : combine les
   * placements de TOUTES les PoolActivity du groupe, pas seulement ceux de
   * `activityId()`. `undefined` = comportement par défaut (placements de
   * cette seule activité de pool).
   */
  readonly assignedPlacementsOverride = input<{ dayId: Date; instanceId: string }[] | undefined>(undefined);

  /**
   * Fourni par `TripActivitiesComponent` pour TOUTES les cartes de la vue
   * "Ville" (tri par lieu), fusionnées ou non : le pictogramme trombone n'a
   * de sens que rapporté à un jour précis, pas dans une vue organisée par
   * lieu — le masquer sur une seule carte "représentante" d'un groupe
   * fusionné et pas sur les autres cartes de la même vue créait une
   * incohérence visuelle (voir ROADMAP.md, retour utilisateur du 2026-07-31).
   * `false` par défaut (comportement normal partout ailleurs : jour, pool
   * général). Ne pilote plus la couleur du bord gauche (voir `typeColorVar`,
   * désormais toujours affichée quel que soit le contexte — ROADMAP.md
   * "UX / Interactions").
   */
  readonly hideBookingMeta = input(false);

  /** Couleur d'identité du type d'activité (voir ACTIVITY_TYPE_META.colorVar) — pilote le bord gauche de la carte, toujours affichée (remplace l'ancienne couleur par statut de réservation). */
  readonly typeColorVar = computed(() => ACTIVITY_TYPE_META[this.activity()?.type ?? ActivityType.ACTIVITE].colorVar);

  /** En contexte jour, `activityId` est un instanceId ; en contexte pool (vue générale), un poolId. */
  readonly activity = computed(() =>
    this.dayId()
      ? this.tripFacade.getDayActivity(this.activityId())()
      : this.tripFacade.getPoolActivityView(this.activityId())()
  );

  private readonly tripActivityPlacements = computed(() => this.tripFacade.getActivityPlacements(this.tripId())());
  /** Placements (jour + instance) de cette activité, triés — uniquement pertinent en contexte pool (vue générale). */
  readonly assignedPlacements = computed(() => {
    const override = this.assignedPlacementsOverride();
    const raw = override ?? this.tripActivityPlacements().get(this.activity().activityId) ?? [];
    return [...raw].sort((a, b) => a.dayId.getTime() - b.dayId.getTime());
  });
  /** true uniquement en contexte pool, quand cette activité n'est placée sur AUCUN jour. */
  readonly isPlacedNowhere = computed(() => !this.dayId() && this.assignedPlacements().length === 0);

  /** En contexte jour, une instance ; en contexte pool, l'activité de pool elle-même — même branchement que l'ancien `confirmDelete`. */
  readonly selectableRef = computed<SelectableItemRef>(() => {
    const dayId = this.dayId();
    return dayId
      ? { kind: 'dayActivityInstance', id: this.activityId(), dayId }
      : { kind: 'poolActivity', id: this.activityId() };
  });

  readonly collapsed = linkedSignal(() => this.initCollapsed());
  /** Piloté par `collapseInstantly()` : coupe la transition CSS du panel le temps d'un repli forcé, pour ne jamais laisser le drag manuel capturer un état mi-animé. */
  protected readonly panelInstant = signal(false);

  /**
   * Émis dès le pointerdown sur la poignée quand `inDayList()` est vrai —
   * DayPanelComponent prend alors intégralement la main sur le geste
   * (collapse, suivi du pointeur, réordonnancement). Voir `startDispatchGesture`.
   * `rowId` (pas `activityId`) : DayReorderService pilote une liste unifiée
   * activités + logistique (voir DraggableDayRow), même émetteur générique
   * pour les deux composants.
   */
  readonly dragHandleDown = output<{ x: number; y: number; pointerId: number; rowId: string }>();

  /** Voir `DraggableDayRow` — DayReorderService pilote une liste unifiée activités + logistique. */
  get rowId(): string {
    return this.activityId();
  }

  readonly kind = 'activity' as const;

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

  private readonly formComponent = viewChild(ActivityFormComponent);

  /** Mobile uniquement, post-création (voir DayActivityCreationService) : démarre le chaînage Type→Résa→Début→Fin→Prix. No-op hors contexte jour (pool général, où `app-activity-form` n'est jamais monté). */
  startGuidedEntry(): void {
    this.formComponent()?.startGuidedEntry();
  }

  /** Clic sur l'heure du header (voir ActivityHeaderComponent, ROADMAP.md "UX / Interactions") : déplie la carte puis ouvre l'éditeur d'heure du form (tiroir mobile, champ déjà visible sur desktop une fois dépliée). */
  protected openStartTime(): void {
    this.collapsed.set(false);
    setTimeout(() => this.formComponent()?.openStartTimeEditor(), PANEL_EXPAND_DELAY_MS);
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

    // Verrouille le swiper (allowTouchMove = false, voir SwiperLockService)
    // pendant TOUTE la durée d'un décrochage pool pour CETTE carte — pool
    // général ET jours vivent tous les deux dans un swiper-slide (voir
    // TripDaySwiperComponent), donc sans ce verrou, Swiper reste libre
    // d'intercepter le geste tactile pour son propre swipe horizontal/vertical
    // pendant qu'on essaie de faire voyager la bulle : symptôme observé,
    // `pointercancel` dès le premier vrai déplacement du doigt, le scroll
    // natif reprenant alors la main. DayPanelComponent verrouille déjà pour
    // son propre réordonnancement intra-jour (et l'escalade qui en découle) ;
    // ceci couvre le cas manquant, le décrochage pool démarré directement
    // depuis ActivityCardComponent.beginLift. `onCleanup` (pas un simple
    // `if/else` sur la valeur précédente) garantit le déverrouillage même si
    // le composant est détruit en plein geste.
    effect((onCleanup) => {
      if (this.isBeingDragged()) {
        this.swiperLockService?.lock();
        onCleanup(() => this.swiperLockService?.unlock());
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

        this.tripFacade.updatePoolActivity(this.tripId(), {
          id: activity.activityId,
          files: activity.files,
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
   * juste après cet appel, dans le même geste.
   */
  collapseInstantly(): void {
    this.panelInstant.set(true);
    this.collapsed.set(true);
    this.cdr.detectChanges();
    requestAnimationFrame(() => this.panelInstant.set(false));
  }

  onPlaceSelected(place: PlaceSummary): void {
    if (!place.placeId) return;
    this.selectedPlace.set(place);
  }

  onPlacementClicked(placement: { dayId: Date; instanceId: string }): void {
    this.dayActivityFocusService.requestFocus(placement.dayId.toISOString(), placement.instanceId);
  }

  /** Chemin Storage des fichiers de cette activité — préfixe SANS le nom de fichier final, voir `FilesFieldComponent.storagePathPrefix`. */
  protected readonly filesStoragePathPrefix = computed(() => `trips/${this.tripId()}/${this.activity()?.activityId}`);

  /** `(filesChange)` de `FilesFieldComponent` (ROADMAP.md "### UI", dédup avec LogisticCardComponent) : les fichiers vivent uniquement sur l'activité de pool, jamais dupliqués par instance — voir CLAUDE.md. */
  onFilesChange(files: FileRef[]): void {
    const activity = this.activity();
    if (!activity) return;

    this.tripFacade.updatePoolActivity(this.tripId(), {
      id: activity.activityId,
      title: activity.title,
      placeId: activity.placeId,
      address: activity.address,
      latitude: activity.latitude,
      longitude: activity.longitude,
      photoRefs: activity.photoRefs,
      files,
    });
  }

  onTitleChanged(newTitle: string): void {
    const activity = this.activity();
    if (!activity) return;

    this.tripFacade.updatePoolActivity(this.tripId(), {
      id: activity.activityId,
      files: activity.files,
      title: newTitle,
      placeId: '',
      address: '',
      latitude: 0,
      longitude: 0,
      photoRefs: [],
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

    // Capture le pointer sur <html> — un élément STABLE qui ne sera jamais
    // caché/transformé/repositionné pendant le drag, contrairement à la
    // carte elle-même (voir card-lifted, et leaveFlowHidden qui masque la
    // vraie carte côté jour). Sans capture explicite, chaque pointermove est
    // re-hit-testé à sa position réelle : si la géométrie de la carte
    // d'origine bouge sous le doigt (qui, lui, ne bouge pas), le hit-test
    // pourrait retomber sur un élément fixe quelconque en dessous.
    try {
      document.documentElement.setPointerCapture(event.pointerId);
    } catch {
      // Ignoré : capture refusée par certains navigateurs/anciens Android —
      // touch-action + preventDefault répété restent la protection de base.
    }

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
      this.dragHandleDown.emit({ x, y, pointerId, rowId: this.activityId() });
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
      this.dispatchService.beginLift(info, el.getBoundingClientRect(), el, x, y);
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

      this.dispatchService.beginLift(info, el.getBoundingClientRect(), el, x, y);
    }, PANEL_COLLAPSE_DELAY_MS);
  }

  private resolveRingColor(el: HTMLElement): string {
    // `.booking` (+ la classe de statut) est posée sur `<app-panel>` lui-même
    // (voir le template) : `--booking-status-color` est une variable CSS,
    // elle n'est visible qu'en descendant du DOM depuis cet élément, jamais
    // en remontant depuis `el` (le conteneur ANCÊTRE). L'ancien sélecteur
    // `.p-panel` datait de PrimeNG (avant le remplacement par PanelComponent,
    // voir PRIMENG_MIGRATION.md) et ne matche plus rien depuis : on retombait
    // donc toujours sur la couleur primaire au lieu de la couleur de statut.
    const panelEl = el.querySelector('.booking') as HTMLElement | null;
    const value = getComputedStyle(panelEl ?? el).getPropertyValue('--booking-status-color').trim();
    return value || 'var(--nt-primary-color)';
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