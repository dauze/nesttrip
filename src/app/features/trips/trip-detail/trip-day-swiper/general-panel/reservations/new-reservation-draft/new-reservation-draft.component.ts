import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, output, viewChild } from '@angular/core';

/**
 * Affiché (mobile ET desktop) à la place de la future carte au clic sur le
 * "+" flottant — champ texte libre focus, PAS de recherche Google (voir
 * ReservationHeaderComponent : le titre d'une réservation n'est jamais lié à
 * un lieu). État 100% local, rien n'est créé dans le store tant que
 * `confirmed` n'a pas été émis : un blur/Entrée avec texte non vide crée la
 * réservation, un blur vide annule sans rien créer.
 */
@Component({
  selector: 'app-new-reservation-draft',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-reservation-draft.component.html',
  styleUrl: './new-reservation-draft.component.scss',
})
export class NewReservationDraftComponent {
  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  /** Une seule soumission possible (Entrée/blur peuvent sinon se chevaucher). */
  private submitted = false;

  constructor() {
    afterNextRender(() => this.inputRef().nativeElement.focus());
  }

  onEnter(value: string): void {
    this.tryConfirmFromText(value);
  }

  onBlur(value: string): void {
    this.tryConfirmFromText(value);
  }

  private tryConfirmFromText(value: string): void {
    if (this.submitted) return;
    this.submitted = true;
    const trimmed = value.trim();
    if (trimmed) this.confirmed.emit(trimmed);
    else this.cancelled.emit();
  }
}
