import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Tient à jour les variables CSS `--nt-visual-viewport-height`/
 * `--nt-visual-viewport-offset-top` (posées sur `<html>`) sur l'état RÉEL du
 * viewport visible — `window.visualViewport`, pas `100vh`/`100dvh` : ces
 * unités CSS suivent l'affichage/masquage de la barre d'adresse mobile mais
 * PAS l'ouverture du clavier virtuel (vérifié : `100dvh` restait plein écran
 * clavier ouvert). `visualViewport`, lui, se redimensionne bien quand le
 * clavier apparaît, sur Android Chrome ET iOS Safari — c'est le seul signal
 * fiable pour ça.
 *
 * `offsetTop` (pas seulement `height`) : certains navigateurs mobiles (mode
 * clavier "overlay"/"resizes-content" selon `interactive-widget`, voir la
 * doc `meta viewport`) ne se contentent pas de RÉDUIRE la hauteur visible à
 * l'ouverture du clavier — le focus sur un `<textarea>` peut aussi faire
 * PANNER (défiler) le viewport visuel vers le bas pour garder le curseur en
 * vue (`visualViewport.offsetTop` > 0), sans que le viewport de MISE EN PAGE
 * (layout viewport, sur lequel `position: fixed` reste ancré) ne bouge lui —
 * un panneau CDK seulement plafonné en HAUTEUR (comme avant ce correctif)
 * reste donc correctement DIMENSIONNÉ mais PAS DÉPLACÉ vers le bas pour
 * suivre ce panning, et se retrouve visuellement à cheval sur la zone
 * masquée par le clavier (pied de page/boutons "OK" coupés — ROADMAP.md
 * "UI", tiroir Notes, capture d'écran fournie par l'utilisateur). Une 1re
 * investigation (2026-08-13) n'avait comparé que le CODE entre
 * `NotesEditDialogComponent`/`TitleEditDialogComponent` (strictement
 * identique niveau mécanisme CSS `--nt-visual-viewport-height`) sans trouver
 * de différence structurelle — `offsetTop` est le facteur qui manquait à
 * cette comparaison, jamais lu ni exposé jusqu'ici. Hypothèse la plus
 * probable au vu du symptôme (hauteur du panneau correcte, seul son
 * POSITIONNEMENT vertical est en cause), mais toujours pas reproductible
 * dans ce bac à sable (pas de clavier virtuel simulable) — à confirmer sur
 * device réel.
 *
 * Consommées par `src/styles/dialog.scss`/`field-edit-dialogs.scss` (popups
 * CDK) pour que leur `max-height`, leur centrage ET leur position verticale
 * (`.cdk-global-overlay-wrapper`) tiennent compte du clavier au lieu de
 * rester calés sur la pleine hauteur/position d'écran AVANT son ouverture
 * (voir ROADMAP.md, "les popup ... ne prennent pas en compte le clavier sur
 * mobile").
 */
@Injectable({ providedIn: 'root' })
export class VisualViewportService {
  private readonly window = inject(DOCUMENT).defaultView!;

  constructor() {
    const vv = this.window.visualViewport;
    if (!vv) return;

    const update = () => {
      const style = this.window.document.documentElement.style;
      style.setProperty('--nt-visual-viewport-height', `${vv.height}px`);
      style.setProperty('--nt-visual-viewport-offset-top', `${vv.offsetTop}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
  }
}
