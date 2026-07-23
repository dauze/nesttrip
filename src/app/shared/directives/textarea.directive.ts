import { Directive, ElementRef, HostListener, afterEveryRender, inject } from '@angular/core';

/**
 * Remplacement maison de `pTextarea` (Phase 4 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Directive de style sur `<textarea>` natif comme
 * InputTextDirective, plus le comportement `autoResize` — toujours activé
 * ici (les usages du projet le demandaient déjà systématiquement via
 * `[autoResize]="true"`, pas besoin d'un input pour le désactiver).
 *
 * `afterEveryRender` (pas `afterNextRender`, qui ne tourne qu'une seule fois) :
 * se recalcule après CHAQUE rendu de l'appli, plutôt que d'essayer de
 * deviner tous les événements qui peuvent changer la valeur affichée
 * (saisie clavier via `(input)`, mais aussi tout changement PROGRAMMATIQUE
 * — ex. `[value]="point.text"` mis à jour par des données Firestore reçues
 * après le premier rendu — qui ne déclenche, lui, aucun événement natif).
 * Une tentative précédente avec `effect()` sur un `value` input dédié
 * s'est révélée pire : l'effet pouvait s'exécuter avant que le navigateur
 * ait fait sa passe de layout, mesurait un `scrollHeight` de 0 et le
 * figeait en dur via `el.style.height`. Mutation DOM directe (pas de
 * binding Angular) : ne redéclenche pas de détection de changements, donc
 * pas de boucle de rendu infinie malgré le hook sur "chaque rendu".
 */
@Directive({
  selector: 'textarea[appTextarea]',
  standalone: true,
  host: {
    class: 'app-textarea',
  },
})
export class TextareaDirective {
  private readonly elementRef = inject(ElementRef<HTMLTextAreaElement>);

  constructor() {
    afterEveryRender(() => this.resize());
  }

  @HostListener('input')
  protected resize(): void {
    const el = this.elementRef.nativeElement;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
