import { AfterViewInit, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@app/core/models/place.dto';

export interface TitleEditDialogData {
  initialTitle: string;
}

/** `raw` : texte libre validé via OK (aucune donnée Google). `place` : suggestion Google choisie dans la liste. */
export type TitleEditDialogResult = { type: 'raw'; text: string } | { type: 'place'; place: PlaceSummary };

/**
 * Tiroir plein écran mobile pour éditer le titre d'une activité (voir
 * ROADMAP.md, "Crayon pour modifier le titre..."). Ouvert par
 * `ActivityHeaderComponent` (via `DialogService`, uniquement quand
 * `ViewportService.isMobile()`) à la place de l'édition inline utilisée sur
 * desktop (`AutoCompleteComponent` dans le header) : sur mobile, taper
 * directement dans le header ouvre un clavier au-dessus d'un panneau ancré
 * minuscule, peu lisible — ce composant occupe toute la page (voir
 * `.app-title-edit-dialog-panel` dans src/styles/title-edit-dialog.scss),
 * champ + bouton OK sur la même ligne en haut, liste de suggestions
 * scrollable juste en dessous (le clavier virtuel réduit la hauteur
 * disponible du panneau, `100dvh`, sans jamais recouvrir la liste).
 *
 * Deux sorties possibles, fermées par `DialogRef.close(result)` :
 * `ActivityHeaderComponent.openTitleEditDialog` route ensuite vers exactement
 * les mêmes chemins que le mode desktop (`onSelect`/`titleEdited`).
 */
@Component({
  selector: 'app-title-edit-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './title-edit-dialog.component.html',
  styleUrl: './title-edit-dialog.component.scss',
})
export class TitleEditDialogComponent implements AfterViewInit {
  private readonly dialogRef = inject(DialogRef<TitleEditDialogResult | undefined>);
  private readonly data = inject<TitleEditDialogData>(DIALOG_DATA);
  private readonly googlePlaceService = inject(GooglePlaceService);

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly inputValue = signal(this.data.initialTitle ?? '');

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
    this.dialogRef.close({ type: 'raw', text: this.inputValue().trim() });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
