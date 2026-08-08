import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@app/core/models/place.dto';
import { MAX_TITLE_LENGTH } from '@app/shared/utils/input-limits';
import { ViewportService } from '@app/core/services/viewport.service';

export interface TitleEditDialogData {
  initialTitle: string;
  /** Texte du champ quand vide — défaut conservé pour les appelants historiques (activité). */
  placeholder?: string;
  /** Titre affiché en tête du tiroir — défaut "Titre" (voir NotesFieldComponent/PriceFieldComponent, même pattern d'uniformité). */
  title?: string;
}

/** `raw` : texte libre validé via OK (aucune donnée Google). `place` : suggestion Google choisie dans la liste. */
export type TitleEditDialogResult = { type: 'raw'; text: string } | { type: 'place'; place: PlaceSummary };

/**
 * Tiroir mobile pour éditer le titre d'une activité ou rechercher un lieu
 * (voir ROADMAP.md, "Crayon pour modifier le titre..."). Ouvert par
 * `ActivityHeaderComponent`/`DayActivityCreationService`/`TripActivitiesCreationService`/
 * `PlaceAutocompleteFieldComponent` (via `DialogService`, uniquement quand
 * `ViewportService.isMobile()`) à la place de l'édition inline utilisée sur
 * desktop : sur mobile, taper directement dans le header ouvre un clavier
 * au-dessus d'un panneau ancré minuscule, peu lisible.
 *
 * Header (croix + titre) / champ de recherche / liste de suggestions /
 * pied "Annuler"-"OK" : même anatomie que `NotesEditDialogComponent`/
 * `PriceEditDialogComponent` (uniformité demandée explicitement par
 * l'utilisateur) — hauteur AUTO plafonnée par `dvh`
 * (`.app-wide-dialog-panel`, field-edit-dialogs.scss), pas plein écran
 * forcé : avec 1-2 suggestions le panneau reste petit, il ne grandit que si
 * la liste en a besoin (scroll interne au-delà, voir
 * `.title-edit-dialog__list` dans le SCSS).
 *
 * Deux sorties possibles, fermées par `DialogRef.close(result)` :
 * cliquer une suggestion ferme immédiatement (choix explicite, pas besoin
 * d'un "OK" séparé) ; le texte libre tapé au clavier passe par le bouton
 * "OK" du pied de page (ou Entrée). Les appelants routent ensuite vers
 * exactement les mêmes chemins que le mode desktop (`onSelect`/`titleEdited`).
 */
@Component({
  selector: 'app-title-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './title-edit-dialog.component.html',
  styleUrl: './title-edit-dialog.component.scss',
})
export class TitleEditDialogComponent implements AfterViewInit {
  private readonly dialogRef = inject(DialogRef<TitleEditDialogResult | undefined>);
  private readonly data = inject<TitleEditDialogData>(DIALOG_DATA);
  private readonly googlePlaceService = inject(GooglePlaceService);
  protected readonly viewport = inject(ViewportService);

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly headerTitle = this.data.title ?? 'Titre';
  protected readonly inputValue = signal(this.data.initialTitle ?? '');
  protected readonly placeholder = this.data.placeholder ?? "Nom de l'activité";
  protected readonly maxLength = MAX_TITLE_LENGTH;

  private readonly searchTerm = signal(this.data.initialTitle ?? '');
  private readonly searchState = toSignal(
    this.googlePlaceService.search$(toObservable(this.searchTerm)),
    { initialValue: { status: 'idle' } as LoadingState<PlaceSummary[]> },
  );

  protected readonly places = computed(() => {
    const s = this.searchState();
    return s.status === 'success' ? s.data : [];
  });
  protected readonly searching = computed(() => this.searchState().status === 'loading');

  ngAfterViewInit(): void {
    const input = this.inputRef().nativeElement;
    input.focus();
    input.select();
  }

  protected onInput(text: string): void {
    this.inputValue.set(text);
    this.searchTerm.set(text);
  }

  protected displayName(place: PlaceSummary): string {
    return this.extractPlaceName(place?.name);
  }

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }

  protected selectPlace(raw: PlaceSummary): void {
    if (!raw?.placeId) return;
    const place: PlaceSummary = { ...raw, name: this.extractPlaceName(raw.name) };
    this.dialogRef.close({ type: 'place', place });
  }

  protected validate(): void {
    const text = this.inputValue().trim();
    if (!text) return;
    this.dialogRef.close({ type: 'raw', text });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
