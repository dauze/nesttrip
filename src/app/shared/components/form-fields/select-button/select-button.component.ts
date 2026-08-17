import { ChangeDetectionStrategy, Component, ElementRef, HostBinding, afterRenderEffect, computed, input, model, signal, viewChildren } from '@angular/core';
import { LabeledOption } from '@app/shared/components/option.model';

/** Alias vers le type partagé `LabeledOption` (voir sa doc) — conservé sous ce nom pour ne pas casser les imports existants. */
export type SelectButtonOption<T = unknown> = LabeledOption<T>;

export type SelectButtonVariant = 'solid' | 'subtle';

/**
 * Remplacement maison de `p-selectbutton` (Phase 4 de la sortie de PrimeNG,
 * voir PRIMENG_MIGRATION.md). Options `{label, value, icon}` directement
 * plutôt que le `<ng-template #item>` de PrimeNG — inutile de gérer un
 * TemplateRef arbitraire pour un appelant dont la forme des options est déjà
 * connue.
 *
 * `variant` : `'solid'` (défaut, historique — bascule Activités/Notes de
 * general-panel, pleine largeur, remplissage couleur primaire) ou `'subtle'`
 * (pilule compacte, largeur auto — pour une bascule secondaire qui ne doit
 * pas visuellement rivaliser avec un `'solid'` déjà affiché juste au-dessus,
 * ex. tri Ville/Chronologique dans l'onglet Activités, Type/Chronologique en
 * Logistique). `'subtle'` rend une vraie pastille glissante (`.app-select-button__thumb`,
 * voir le template/le SCSS) derrière l'option active plutôt qu'un simple
 * `box-shadow` — matérialise "un switch avec le rond en couleur" (voir
 * ROADMAP.md "UX / Interactions"). Les items sont `flex: 0 0 auto` (largeur
 * dictée par leur contenu, icône+libellé, jamais égale entre 2 options —
 * "Lieu" vs "Chronologie" par ex.) : la pastille est donc positionnée/
 * dimensionnée par MESURE DOM réelle de l'item actif (`offsetLeft`/
 * `offsetWidth`, voir `thumbRect`/`afterRenderEffect` ci-dessous), jamais par
 * un simple `100% / options().length` — un premier jet en pourcentage fixe
 * ne correspondait pas à la largeur réelle des boutons, pastille visuellement
 * désalignée.
 */
@Component({
  selector: 'app-select-button',
  standalone: true,
  templateUrl: './select-button.component.html',
  styleUrl: './select-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectButtonComponent<T = unknown> {
  readonly options = input.required<SelectButtonOption<T>[]>();
  readonly value = model<T | undefined>(undefined);
  readonly variant = input<SelectButtonVariant>('solid');

  @HostBinding('class')
  protected get hostClass(): string {
    return `app-select-button--${this.variant()}`;
  }

  /** Index de l'option active — pilote la pastille glissante du variant 'subtle' (voir select-button.component.html/.scss). -1 si aucune option ne correspond à `value()` (état transitoire au premier rendu). */
  protected readonly activeIndex = computed(() => this.options().findIndex(o => o.value === this.value()));

  private readonly itemEls = viewChildren<ElementRef<HTMLButtonElement>>('itemEl');

  /** Position/taille réelles (px) de l'item actif, mesurées après rendu — voir la doc de classe. `null` tant qu'il n'y a rien à afficher (aucune option active). */
  protected readonly thumbRect = signal<{ left: number; width: number } | null>(null);

  constructor() {
    afterRenderEffect(() => {
      const index = this.activeIndex();
      const target = this.itemEls()[index]?.nativeElement;
      this.thumbRect.set(target ? { left: target.offsetLeft, width: target.offsetWidth } : null);
    });
  }

  protected select(option: SelectButtonOption<T>): void {
    this.value.set(option.value);
  }
}
