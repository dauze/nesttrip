import { Directive, DestroyRef, ElementRef, Renderer2, effect, inject, input } from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type TooltipEvent = 'hover' | 'focus' | 'both';

/** Écart entre la cible et la bulle (voir preset Aura `tooltip.gutter`). */
const GUTTER_PX = 4;
/** Marge de sécurité pour ne jamais coller la bulle au bord de l'écran. */
const VIEWPORT_MARGIN_PX = 4;

/**
 * Remplacement maison de `pTooltip` (Phase 7 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Pas de `@angular/cdk/overlay` ici : les 3 usages du
 * projet sont de simples bulles de texte sans interaction (jamais de focus
 * trap/clic extérieur à gérer, contrairement à Dialog/Menu/Select) — un
 * `<div>` positionné en `fixed` directement sur `document.body` suffit,
 * sans dépendance supplémentaire.
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  readonly appTooltip = input<string>('');
  readonly tooltipPosition = input<TooltipPosition>('top');
  readonly tooltipDisabled = input(false);
  /** Comme PrimeNG : 'hover' (défaut), 'focus', ou 'both' pour les deux. */
  readonly tooltipEvent = input<TooltipEvent>('hover');

  private tooltipEl?: HTMLElement;
  private reposition?: () => void;

  constructor() {
    const host = this.elementRef.nativeElement;
    this.renderer.listen(host, 'mouseenter', () => this.handleEnter('hover'));
    this.renderer.listen(host, 'mouseleave', () => this.handleLeave('hover'));
    // `focusin`/`focusout` (pas `focus`/`blur`, qui ne bubblent pas) : la
    // cible réellement focusable est parfois un élément interne au composant
    // qui porte la directive (ex. `<app-button appTooltip>`, dont le `host`
    // n'est pas lui-même le `<button>` natif) — seuls les événements qui
    // remontent permettent au listener posé ici sur le host de les capter.
    this.renderer.listen(host, 'focusin', () => this.handleEnter('focus'));
    this.renderer.listen(host, 'focusout', () => this.handleLeave('focus'));
    this.renderer.listen(host, 'click', () => this.hide());

    // Ferme/rafraîchit en direct si l'état bascule pendant que la bulle est
    // déjà affichée (ex. `tooltipDisabled` qui devient vrai en cours de
    // survol, comme dans accueil-trip quand `editMode` change).
    effect(() => {
      const disabled = this.tooltipDisabled();
      const text = this.appTooltip();
      if (!this.tooltipEl) return;
      if (disabled || !text) {
        this.hide();
      } else {
        this.tooltipEl.textContent = text;
        this.position();
      }
    });

    this.destroyRef.onDestroy(() => this.hide());
  }

  private handleEnter(source: 'hover' | 'focus'): void {
    const mode = this.tooltipEvent();
    if (mode === 'both' || mode === source) this.show();
  }

  private handleLeave(source: 'hover' | 'focus'): void {
    const mode = this.tooltipEvent();
    if (mode === 'both' || mode === source) this.hide();
  }

  private show(): void {
    if (this.tooltipEl || this.tooltipDisabled() || !this.appTooltip()) return;

    const el = this.renderer.createElement('div') as HTMLElement;
    el.className = 'app-tooltip';
    el.textContent = this.appTooltip();
    this.renderer.appendChild(document.body, el);
    this.tooltipEl = el;
    this.position();

    this.reposition = () => this.position();
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
  }

  private hide(): void {
    if (!this.tooltipEl) return;
    this.renderer.removeChild(document.body, this.tooltipEl);
    this.tooltipEl = undefined;
    if (this.reposition) {
      window.removeEventListener('scroll', this.reposition, true);
      window.removeEventListener('resize', this.reposition);
      this.reposition = undefined;
    }
  }

  private position(): void {
    const el = this.tooltipEl;
    if (!el) return;
    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    const tooltipRect = el.getBoundingClientRect();

    let top: number;
    let left: number;
    switch (this.tooltipPosition()) {
      case 'bottom':
        top = hostRect.bottom + GUTTER_PX;
        left = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = hostRect.top + hostRect.height / 2 - tooltipRect.height / 2;
        left = hostRect.left - tooltipRect.width - GUTTER_PX;
        break;
      case 'right':
        top = hostRect.top + hostRect.height / 2 - tooltipRect.height / 2;
        left = hostRect.right + GUTTER_PX;
        break;
      default:
        top = hostRect.top - tooltipRect.height - GUTTER_PX;
        left = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;
    }

    const maxLeft = window.innerWidth - tooltipRect.width - VIEWPORT_MARGIN_PX;
    const maxTop = window.innerHeight - tooltipRect.height - VIEWPORT_MARGIN_PX;
    el.style.top = `${Math.min(Math.max(VIEWPORT_MARGIN_PX, top), Math.max(VIEWPORT_MARGIN_PX, maxTop))}px`;
    el.style.left = `${Math.min(Math.max(VIEWPORT_MARGIN_PX, left), Math.max(VIEWPORT_MARGIN_PX, maxLeft))}px`;
  }
}
