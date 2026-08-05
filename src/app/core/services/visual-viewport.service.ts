import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Tient à jour la variable CSS `--nt-visual-viewport-height` (posée sur
 * `<html>`) sur la hauteur RÉELLEMENT visible de l'écran — `window.visualViewport`,
 * pas `100vh`/`100dvh` : ces unités CSS suivent l'affichage/masquage de la
 * barre d'adresse mobile mais PAS l'ouverture du clavier virtuel (vérifié :
 * `100dvh` restait plein écran clavier ouvert). `visualViewport`, lui, se
 * redimensionne bien quand le clavier apparaît, sur Android Chrome ET iOS
 * Safari — c'est le seul signal fiable pour ça.
 *
 * Consommée par `src/styles/dialog.scss`/`field-edit-dialogs.scss` (popups
 * CDK) pour que leur `max-height` ET leur centrage (`.cdk-global-overlay-wrapper`)
 * tiennent compte du clavier au lieu de rester calés sur la pleine hauteur
 * d'écran (voir ROADMAP.md, "les popup ... ne prennent pas en compte le
 * clavier sur mobile").
 */
@Injectable({ providedIn: 'root' })
export class VisualViewportService {
  private readonly window = inject(DOCUMENT).defaultView!;

  constructor() {
    const vv = this.window.visualViewport;
    if (!vv) return;

    const update = () => {
      this.window.document.documentElement.style.setProperty(
        '--nt-visual-viewport-height',
        `${vv.height}px`,
      );
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
  }
}
