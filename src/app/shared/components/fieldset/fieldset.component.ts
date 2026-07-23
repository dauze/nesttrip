import { Component, input, linkedSignal } from '@angular/core';

/**
 * Remplacement maison de `p-fieldset` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Un seul usage dans ce projet (notes.component,
 * bloc "éléments terminés" repliable) : header via un slot projeté
 * `[fieldsetHeader]` plutôt que le `<ng-template #header>` de PrimeNG (qui
 * aurait demandé un `@ContentChild(TemplateRef)` pour rien vu qu'il n'y a
 * qu'un seul appelant à adapter), icônes chevron fixes (pas de template
 * `#expandicon`/`#collapseicon` personnalisable — l'appelant unique utilisait
 * déjà exactement ces icônes-là).
 */
@Component({
  selector: 'app-fieldset',
  standalone: true,
  templateUrl: './fieldset.component.html',
  styleUrl: './fieldset.component.scss',
})
export class FieldsetComponent {
  readonly toggleable = input(false);
  readonly collapsed = input(false);

  protected readonly isCollapsed = linkedSignal(() => this.collapsed());

  protected toggle(): void {
    if (!this.toggleable()) return;
    this.isCollapsed.update((v) => !v);
  }
}
