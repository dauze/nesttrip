import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';
import { MAX_NOTES_LENGTH } from '@app/shared/utils/input-limits';

export interface NotesEditDialogData {
  initialValue: string;
  placeholder: string;
  title: string;
  /** Appelé uniquement à la validation ("OK") — voir NotesFieldComponent, la saisie reste un brouillon local tant que ce tiroir est ouvert. */
  onConfirm: (value: string) => void;
}

/**
 * Tiroir mobile pour éditer les notes d'une activité/réservation (voir
 * ROADMAP.md). Ouvert par `NotesFieldComponent.openDialog()` via
 * `DialogService`. Hauteur AUTO (pas plein écran fixe, voir
 * field-edit-dialogs.scss `.app-notes-dialog-panel`) : le `<textarea>`
 * utilise `appTextarea` (même directive auto-resize que le reste de l'app)
 * pour ne prendre qu'une ligne à vide et grandir avec le texte, jusqu'à sa
 * propre `max-height` (voir notes-edit-dialog.component.scss) — au-delà, le
 * `<textarea>` scrolle NATIVEMENT (son propre `overflow-y:auto`), pas le
 * panneau parent : le navigateur garde le curseur visible tout seul pendant
 * la frappe (voir la doc git de ce fichier pour la version précédente,
 * défaillante, qui essayait de scroller le panneau CDK à la main).
 *
 * Brouillon local + "Annuler"/"OK" (même pattern que
 * `TimePickerClockComponent`, pour l'uniformité entre tiroirs mobile) : la
 * frappe ne modifie QUE `value` ici, `data.onConfirm` n'est appelé qu'au clic
 * sur "OK". Fermer autrement (croix, "Annuler", backdrop/Échap gérés par
 * CDK) abandonne le brouillon sans rien modifier — remplace l'ancienne
 * synchro live (à chaque frappe) d'avant cette demande utilisateur.
 */
@Component({
  selector: 'app-notes-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TextareaDirective],
  templateUrl: './notes-edit-dialog.component.html',
  styleUrl: './notes-edit-dialog.component.scss',
})
export class NotesEditDialogComponent implements AfterViewInit {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<NotesEditDialogData>(DIALOG_DATA);

  private readonly textareaRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('textareaEl');

  protected readonly value = signal(this.data.initialValue ?? '');
  protected readonly maxLength = MAX_NOTES_LENGTH;

  ngAfterViewInit(): void {
    const textarea = this.textareaRef().nativeElement;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }

  protected onInput(text: string): void {
    this.value.set(text);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    this.data.onConfirm(this.value());
    this.dialogRef.close();
  }
}
