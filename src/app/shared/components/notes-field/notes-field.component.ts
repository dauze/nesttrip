import { ChangeDetectionStrategy, Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';
import { NotesEditDialogComponent, NotesEditDialogData } from './notes-edit-dialog/notes-edit-dialog.component';

/**
 * Champ notes d'une activité/réservation (voir ROADMAP.md "Édition d'activité
 * 100% par composants dédiés mobile"). Même bascule que
 * `TimePickerDialogComponent`/`SelectComponent` : sur desktop, édition inline
 * strictement inchangée (même `<textarea appTextarea>` qu'avant ce composant) ;
 * sur mobile, un trigger transparent ouvre un tiroir via `DialogService`,
 * centré sur l'écran (position par défaut de `DialogService`, comme tous
 * les autres dialogs de l'app — voir field-edit-dialogs.scss sur pourquoi
 * une tentative de repositionnement CSS custom a été abandonnée), hauteur
 * auto (une ligne à vide, grandit avec le texte jusqu'à `100dvh` puis
 * scrolle, voir NotesEditDialogComponent). Brouillon + "Annuler"/"OK" (même
 * pattern que `TimePickerClockComponent`, pour l'uniformité entre tiroirs
 * mobile) : la saisie dans le tiroir ne remonte ici (`onChange`) qu'au clic
 * sur "OK" (`data.onConfirm`) — fermer autrement (croix, "Annuler",
 * backdrop/Échap) abandonne le brouillon.
 */
@Component({
  selector: 'app-notes-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextareaDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NotesFieldComponent),
      multi: true,
    },
  ],
  templateUrl: './notes-field.component.html',
  styleUrl: './notes-field.component.scss',
})
export class NotesFieldComponent implements ControlValueAccessor {
  private readonly dialogService = inject(DialogService);
  protected readonly viewport = inject(ViewportService);

  readonly placeholder = input('Ajouter une note…');
  readonly title = input('Notes');
  /** Id posé sur le `<textarea>` interne (desktop), pas sur le host — même convention que `InputNumberComponent.inputId` (nécessaire pour un `<label for="...">` externe). */
  readonly inputId = input<string>('');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange?: (value: string) => void;
  private onTouched?: () => void;

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(text: string): void {
    this.value.set(text);
    this.onChange?.(text);
  }

  /** Public : ouverture programmatique (cohérence avec `openPanel()`/`openDialog()` des autres champs mobiles). */
  openDialog(): void {
    const dialogRef = this.dialogService.open<void, NotesEditDialogData>(NotesEditDialogComponent, {
      data: {
        initialValue: this.value(),
        placeholder: this.placeholder(),
        title: this.title(),
        onConfirm: (text) => this.onInput(text),
      },
      panelClass: 'app-wide-dialog-panel',
      autoFocus: '.notes-edit-dialog__textarea',
    });
    dialogRef.closed.subscribe(() => this.onTouched?.());
  }
}
