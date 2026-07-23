import { Directive } from '@angular/core';

/**
 * Remplacement maison de `pInputText` (Phase 4 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Comme l'original, une simple directive de style sur
 * un `<input>` natif — `formControlName`/`ngModel` fonctionnent déjà nativement
 * dessus, aucun ControlValueAccessor à écrire. Le style vit dans
 * src/styles/form-fields.scss (global, pas scopé à un composant).
 */
@Directive({
  selector: 'input[appInputText]',
  standalone: true,
  host: {
    class: 'app-input-text',
  },
})
export class InputTextDirective {}
