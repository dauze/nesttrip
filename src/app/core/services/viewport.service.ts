import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const MOBILE_QUERY = '(max-width: 768px)';

// Layout scindé (carte à gauche / activités à droite / jours en haut) : desktop
// ET mobile tenu en paysage, décision produit — pas un simple seuil de largeur
// (voir ROADMAP.md, section "UI Desktop"). `isChromePinned` affine encore :
// même en layout scindé, un mobile en paysage manque de hauteur pour garder
// toolbar+header+jours en permanence visibles (voir TripChromeService.setMode).
// Seuils dupliqués tels quels dans les media queries SCSS équivalentes
// (même convention que MOBILE_QUERY ci-dessus, voir styles.scss).
const SPLIT_LAYOUT_QUERY = '(orientation: landscape) and (min-width: 700px)';
const CHROME_PINNED_QUERY = '(orientation: landscape) and (min-width: 700px) and (min-height: 500px)';

/** Signal réactif indiquant si le viewport correspond au breakpoint mobile (voir styles.scss). */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly window = inject(DOCUMENT).defaultView!;
  private readonly media = this.window.matchMedia(MOBILE_QUERY);
  private readonly _isMobile = signal(this.media.matches);
  readonly isMobile = this._isMobile.asReadonly();

  private readonly splitLayoutMedia = this.window.matchMedia(SPLIT_LAYOUT_QUERY);
  private readonly _isSplitLayout = signal(this.splitLayoutMedia.matches);
  /** Carte à gauche / activités à droite / jours en haut (desktop ou mobile paysage). */
  readonly isSplitLayout = this._isSplitLayout.asReadonly();

  private readonly chromePinnedMedia = this.window.matchMedia(CHROME_PINNED_QUERY);
  private readonly _isChromePinned = signal(this.chromePinnedMedia.matches);
  /** En plus du layout scindé, assez de hauteur pour garder toolbar+header+jours toujours visibles. */
  readonly isChromePinned = this._isChromePinned.asReadonly();

  constructor() {
    this.media.addEventListener('change', (event) => this._isMobile.set(event.matches));
    this.splitLayoutMedia.addEventListener('change', (event) => this._isSplitLayout.set(event.matches));
    this.chromePinnedMedia.addEventListener('change', (event) => this._isChromePinned.set(event.matches));
  }
}
