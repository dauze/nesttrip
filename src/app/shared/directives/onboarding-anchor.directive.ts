import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { OnboardingTourService } from '@app/core/onboarding/onboarding-tour.service';

/**
 * Enregistre son élément hôte comme cible possible d'un coach mark (voir
 * `OnboardingTourService.getAnchorRect`) sous l'id donné — permet à
 * `CoachMarkOverlayComponent` de découper le fond grisé autour de cet
 * élément sans coupler les composants entre eux, même esprit que
 * `TripChromeService.registerChromeElement`. Réactif (`effect`, pas
 * `ngOnInit`/`ngOnDestroy`) : un id `null`/vide se désenregistre — utile pour
 * une ancre CONDITIONNELLE posée sur un composant potentiellement préchargé
 * en plusieurs instances, dont une seule à la fois doit compter comme ancre.
 */
@Directive({
  selector: '[appOnboardingAnchor]',
  standalone: true,
})
export class OnboardingAnchorDirective {
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly tourService = inject(OnboardingTourService);

  readonly appOnboardingAnchor = input<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const id = this.appOnboardingAnchor();
      if (!id) return;
      this.tourService.registerAnchor(id, this.elRef.nativeElement);
      onCleanup(() => this.tourService.unregisterAnchor(id, this.elRef.nativeElement));
    });
  }
}
