import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { MAX_TITLE_LENGTH } from '@app/shared/utils/input-limits';
import { ViewportService } from '@app/core/services/ui/viewport.service';

export interface SimpleTextEntryDialogData {
  initialValue?: string;
  placeholder?: string;
  title?: string;
  /** OK reste actif même à vide (le champ est facultatif, ex. "Nom de la location" — voir ROADMAP.md cinématique Location voiture). */
  optional?: boolean;
}

/**
 * Tiroir minimal "un champ texte + OK" — sous-ensemble de `TitleEditDialogComponent`
 * sans la recherche Google, pour les quelques champs texte des cinématiques de
 * création guidée Logistique qui n'ont pas de sens comme lieu Google (numéro
 * de vol, nom du loueur). Même anatomie (header/champ/pied Annuler-OK) que
 * `TitleEditDialogComponent`/`NotesEditDialogComponent`/`PriceEditDialogComponent`.
 */
@Component({
  selector: 'app-simple-text-entry-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './simple-text-entry-dialog.component.html',
  styleUrl: './simple-text-entry-dialog.component.scss',
})
export class SimpleTextEntryDialogComponent implements AfterViewInit {
  private readonly dialogRef = inject(DialogRef<string | undefined>);
  private readonly data = inject<SimpleTextEntryDialogData>(DIALOG_DATA);
  protected readonly viewport = inject(ViewportService);

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly headerTitle = this.data.title ?? 'Titre';
  protected readonly placeholder = this.data.placeholder ?? '';
  protected readonly optional = this.data.optional ?? false;
  protected readonly inputValue = signal(this.data.initialValue ?? '');
  protected readonly maxLength = MAX_TITLE_LENGTH;

  ngAfterViewInit(): void {
    const input = this.inputRef().nativeElement;
    input.focus();
    input.select();
  }

  protected onInput(text: string): void {
    this.inputValue.set(text);
  }

  protected validate(): void {
    const text = this.inputValue().trim();
    if (!text && !this.optional) return;
    this.dialogRef.close(text);
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
