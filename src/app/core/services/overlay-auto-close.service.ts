import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, inject } from '@angular/core';

/** Contrat implémenté par la directive attachée à chaque p-select / p-datepicker. */
export interface AutoCloseOverlay {
  isOpen(): boolean;
  hostElement(): HTMLElement;
  /** Sélecteur CSS du panneau flottant de ce type de composant (ex: '.p-select-overlay'). */
  readonly panelSelector: string;
  close(): void;
}

/**
 * Coordonne la fermeture des overlays PrimeNG (p-select, p-datepicker, ...) à
 * travers toute l'application.
 *
 * Pourquoi ne pas se contenter du comportement natif de PrimeNG ? Chaque
 * composant ferme son propre panneau sur un clic extérieur détecté via un
 * listener posé sur `document`, mais ces listeners tournent indépendamment
 * les uns des autres. Résultat : cliquer sur le déclencheur d'un p-select
 * pendant qu'un p-datepicker est ouvert peut faire stopPropagation() sur le
 * `click` avant qu'il n'atteigne le listener du datepicker, qui reste alors
 * ouvert en même temps que le select — exactement le bug remonté. Un swipe
 * ne déclenche par ailleurs aucun `click`, donc aucun des deux ne se ferme.
 *
 * Ce service prend le contrôle explicite : un seul listener `pointerdown` en
 * phase de capture (donc exécuté avant tout stopPropagation() interne) ferme
 * tout overlay ouvert dès que le point de contact est en dehors de son hôte
 * et de son panneau. `closeAll()` permet en plus de fermer tout, sur demande
 * (ex: au tout début d'un swipe).
 */
@Injectable({ providedIn: 'root' })
export class OverlayAutoCloseService {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly overlays = new Set<AutoCloseOverlay>();
  private listenerBound = false;

  register(overlay: AutoCloseOverlay): void {
    this.overlays.add(overlay);
    this.ensureListener();
  }

  unregister(overlay: AutoCloseOverlay): void {
    this.overlays.delete(overlay);
  }

  /** Ferme immédiatement tous les overlays actuellement ouverts (ex: début d'un swipe). */
  closeAll(): void {
    for (const overlay of this.overlays) {
      if (overlay.isOpen()) overlay.close();
    }
  }

  private ensureListener(): void {
    if (this.listenerBound) return;
    this.listenerBound = true;

    // Le listener lui-même tourne hors zone Angular (perf : il se déclenche
    // à CHAQUE pointerdown de l'app), on ne rentre dans la zone que si on a
    // effectivement quelque chose à fermer, pour déclencher le CD nécessaire.
    this.zone.runOutsideAngular(() => {
      this.document.addEventListener('pointerdown', (event) => this.onPointerDown(event), {
        capture: true,
      });
    });
  }

  private onPointerDown(event: Event): void {
    const target = event.target;
    if (!(target instanceof Node)) return;

    const toClose: AutoCloseOverlay[] = [];
    for (const overlay of this.overlays) {
      if (!overlay.isOpen()) continue;
      if (overlay.hostElement().contains(target)) continue;
      if (target instanceof Element && target.closest(overlay.panelSelector)) continue;
      toClose.push(overlay);
    }

    if (toClose.length === 0) return;
    this.zone.run(() => {
      for (const overlay of toClose) overlay.close();
    });
  }
}