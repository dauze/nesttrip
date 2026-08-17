import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms'; // Import de ReactiveForms
import { AutoCompleteComponent } from '@app/shared/components/form-fields/autocomplete/autocomplete.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_META } from '../activity.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';
import { extractPlaceName } from '@app/shared/utils/place-name.util';
import { GooglePhotoService } from '@app/core/services/api/google-photo.service';
import { GooglePlaceService } from '@app/core/services/api/google-place.service';
import { PhotoViewerService } from '@app/core/services/ui/photo-viewer.service';
import { LoadingState, PlaceSummary } from '@app/core/models/place.dto';
import { TagComponent } from '@app/shared/components/feedback/tag/tag.component';
import { ViewportService } from '@app/core/services/ui/viewport.service';
import { DialogService } from '@app/shared/services/dialog.service';
import { TitleEditDialogComponent, TitleEditDialogData, TitleEditDialogResult } from './title-edit-dialog/title-edit-dialog.component';

@Component({
  selector: 'app-activity-header',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutoCompleteComponent, TagComponent],
  templateUrl: './activity-header.component.html',
  styleUrl: './activity-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityHeaderComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly photoCache = inject(GooglePhotoService);
  private readonly photoViewerService = inject(PhotoViewerService);
  protected readonly viewport = inject(ViewportService);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly activity = input.required<Activity>();
  readonly dayId = input.required<Date | undefined>();
  readonly isPlacedNowhere = input.required<boolean>();
  readonly assignedPlacements = input.required<{ dayId: Date; instanceId: string }[]>();
  /** Vue "Ville" (voir ActivityCardComponent.hideBookingMeta) : masque le trombone, qui n'a de sens que rapporté à un jour précis. */
  readonly hideBookingMeta = input(false);

  readonly placeSelected = output<PlaceSummary>();
  readonly titleEdited = output<string>();
  readonly placementClicked = output<{ dayId: Date; instanceId: string }>();
  /** Clic sur l'heure de début (voir ROADMAP.md "UX / Interactions") : `ActivityCardComponent` déplie la carte et ouvre l'éditeur d'heure du form. */
  readonly timeClicked = output<void>();

  readonly activityTypeMeta = ACTIVITY_TYPE_META;

  // Recherche scopée à CETTE instance : deux ActivityHeaderComponent
  // simultanément affichés (ex. plusieurs cartes dans la vue "Activités")
  // ne partagent plus le même état de recherche global, contrairement à
  // l'ancien `googlePlaceService.places`/`searching` (signaux uniques
  // partagés par toute l'app).
  private readonly searchTerm = signal('');
  private readonly searchState = toSignal(
    this.googlePlaceService.search$(toObservable(this.searchTerm)),
    { initialValue: { status: 'idle' } as LoadingState<PlaceSummary[]> },
  );

  readonly places = computed(() => {
    const s = this.searchState();
    return s.status === 'success' ? s.data : [];
  });
  readonly searching = computed(() => this.searchState().status === 'loading');

  readonly titleControl = new FormControl('', { nonNullable: true });

  readonly firstPhotoRef = computed(() => {
    const refs = this.activity().photoRefs;
    return refs && refs.length > 0 ? refs[0] : null;
  });

  readonly hasFiles = computed(() => !this.hideBookingMeta() && (this.activity().files?.length ?? 0) > 0);

  constructor() {
     runOnceReady(this.activity, (a) => this.titleControl.setValue(a.title, { emitEvent: false }));
  }

  onSearch(query: string): void {
    this.searchTerm.set(query ?? '');
  }

  onSelect(raw: PlaceSummary): void {
    if (!raw?.placeId) return;

    const place: PlaceSummary = { ...raw, name: extractPlaceName(raw.name) };

    // En forçant la valeur ici, le FormControl court-circuite le composant
    // et lui réinjecte immédiatement la string. Zéro flash global.
    this.titleControl.setValue(place.name);

    this.placeSelected.emit(place);
  }

  // Fonction fléchée (pas une méthode ordinaire) : passée par référence à
  // `[displayWith]` (voir le template), donc appelée plus tard depuis
  // AutoCompleteComponent SANS son `this` d'origine.
  displayName = (place: { name: unknown }): string => extractPlaceName(place?.name);

  onTitleBlur(): void {
    const next = this.titleControl.value;
    if (typeof next !== 'string') return;

    const trimmed = next.trim();
    if (this.activity().title === trimmed) return;
    this.titleEdited.emit(trimmed);
  }

  /**
   * Mobile uniquement (voir template) : ouvre le tiroir dédié d'édition du
   * titre à la place de l'autocomplete inline utilisée sur desktop.
   * `stopPropagation` : le crayon vit dans `.activity-header__meta`, qui ne
   * stoppe plus lui-même la propagation en mode mobile (voir template) pour
   * que le reste du header (y compris le titre) déplie/replie le panneau au
   * clic, comme n'importe quelle autre zone du header — seul le crayon a
   * besoin d'intercepter le clic pour ouvrir le tiroir plutôt que basculer le
   * panneau.
   *
   * `viewContainerRef` explicite : sans lui, `Dialog.open` (CDK) instancie le
   * composant avec l'injecteur racine plutôt que celui de cette vue —
   * `GooglePlaceService` (`@Injectable()` SANS `providedIn`, fourni au niveau
   * de `TripsComponent` pour partager son cache entre toutes les cartes d'un
   * trip) resterait alors introuvable dans `TitleEditDialogComponent`
   * (NG0201). Voir la même chaîne d'injecteur documentée dans
   * `@angular/cdk/dialog` (`config.viewContainerRef?.injector`).
   */
  openTitleEditDialog(event: MouseEvent): void {
    event.stopPropagation();

    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: this.activity().title },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // `autoFocus: 'first-tabbable'` (défaut de DialogService) focaliserait
        // le bouton de fermeture (premier élément focusable du template, voir
        // TitleEditDialogComponent), pas le champ de saisie — l'autofocus CDK
        // s'exécute après `ngAfterViewInit` du contenu et écrase le
        // `input.focus()` qui y est déjà posé. Même pattern que
        // TimePickerDialogComponent (mode durée) pour cibler directement le champ.
        autoFocus: '.title-edit-dialog__input',
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (!result) return;

      if (result.type === 'place') {
        this.onSelect(result.place);
        return;
      }

      const trimmed = result.text.trim();
      this.titleControl.setValue(trimmed);
      if (this.activity().title === trimmed) return;
      this.titleEdited.emit(trimmed);
    });
  }

  /**
   * `stopPropagation` : même besoin que `openPhotoViewer`/`openTitleEditDialog`
   * ci-dessus — sans ça, le clic remonterait au header et déplierait/replierait
   * le panneau de la carte au lieu de naviguer vers le jour ciblé.
   */
  onPlacementClick(event: Event, placement: { dayId: Date; instanceId: string }): void {
    event.stopPropagation();
    this.placementClicked.emit(placement);
  }

  /** `stopPropagation` : même besoin que `onPlacementClick` ci-dessus — sans ça, le clic remonterait au header et déplierait/replierait le panneau au lieu d'ouvrir l'éditeur d'heure. */
  onTimeClick(event: Event): void {
    event.stopPropagation();
    this.timeClicked.emit();
  }

  getPhotoUrl$(ref: string, maxWidth = 100) {
    return this.photoCache.getPhotoUrl$(ref, maxWidth);
  }

  /**
   * Ouvre le visionneur plein écran depuis la miniature cliquée. `stopPropagation`
   * : sans ça le clic remonterait au header et déplierait/replierait le panneau
   * de la carte (même raison que `openTitleEditDialog` ci-dessus).
   */
  openPhotoViewer(event: Event): void {
    event.stopPropagation();

    const placeId = this.activity().placeId;
    if (!placeId) return;

    this.photoViewerService.open({
      placeId,
      altText: this.activity().title,
      triggerEl: event.currentTarget as HTMLElement,
    });
  }
}