import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const MOBILE_QUERY = '(max-width: 768px)';

/** Signal réactif indiquant si le viewport correspond au breakpoint mobile (voir styles.scss). */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly media = inject(DOCUMENT).defaultView!.matchMedia(MOBILE_QUERY);
  private readonly _isMobile = signal(this.media.matches);
  readonly isMobile = this._isMobile.asReadonly();

  constructor() {
    this.media.addEventListener('change', (event) => this._isMobile.set(event.matches));
  }
}
