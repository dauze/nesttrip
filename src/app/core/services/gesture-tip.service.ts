import { Injectable } from '@angular/core';

/** Écart entre la carte ciblée et la bulle (même valeur que `TooltipDirective`). */
const GUTTER_PX = 4;
const VIEWPORT_MARGIN_PX = 4;
/** Dismiss auto (spec, étape 4 : "quelques secondes") — voir aussi `hide()` sur premier geste réussi. */
const AUTO_DISMISS_MS = 4000;

/**
 * Astuce de geste ponctuelle (src/specs/Parcours-new-user.md, étape 4) :
 * tooltip flottant collé à un élément, pas de fond grisé, pas de Suivant/
 * Précédent — juste un dismiss auto ou sur premier geste réussi. Même
 * technique qu'`TooltipDirective` (un `<div popover="manual">` posé
 * directement sur `document.body`, pas de `@angular/cdk/overlay`) plutôt
 * qu'un composant Angular monté via `ViewContainerRef` : un seul texte
 * statique à afficher, sans interaction, ne justifie pas plus.
 */
@Injectable({ providedIn: 'root' })
export class GestureTipService {
  private tipEl?: HTMLElement;
  private dismissTimer?: ReturnType<typeof setTimeout>;
  private reposition?: () => void;

  show(anchor: HTMLElement, text: string): void {
    this.hide();

    const el = document.createElement('div');
    el.className = 'app-gesture-tip';
    el.textContent = text;
    if ('popover' in el) el.setAttribute('popover', 'manual');
    document.body.appendChild(el);
    this.tipEl = el;
    if ('showPopover' in el) (el as HTMLElement & { showPopover(): void }).showPopover();
    this.position(anchor);

    this.reposition = () => this.position(anchor);
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);

    this.dismissTimer = setTimeout(() => this.hide(), AUTO_DISMISS_MS);
  }

  /** Dismiss manuel (premier geste réussi, ou navigation qui invalide l'ancre) — no-op si rien n'est affiché. */
  hide(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = undefined;
    }
    if (this.reposition) {
      window.removeEventListener('scroll', this.reposition, true);
      window.removeEventListener('resize', this.reposition);
      this.reposition = undefined;
    }
    if (!this.tipEl) return;
    if ('hidePopover' in this.tipEl) (this.tipEl as HTMLElement & { hidePopover(): void }).hidePopover();
    this.tipEl.remove();
    this.tipEl = undefined;
  }

  private position(anchor: HTMLElement): void {
    const el = this.tipEl;
    if (!el) return;
    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = el.getBoundingClientRect();

    const top = anchorRect.bottom + GUTTER_PX;
    const left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;

    const maxLeft = window.innerWidth - tipRect.width - VIEWPORT_MARGIN_PX;
    const maxTop = window.innerHeight - tipRect.height - VIEWPORT_MARGIN_PX;
    el.style.top = `${Math.min(Math.max(VIEWPORT_MARGIN_PX, top), Math.max(VIEWPORT_MARGIN_PX, maxTop))}px`;
    el.style.left = `${Math.min(Math.max(VIEWPORT_MARGIN_PX, left), Math.max(VIEWPORT_MARGIN_PX, maxLeft))}px`;
  }
}
