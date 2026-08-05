import { TestBed } from '@angular/core/testing';
import { TripChromeService } from './trip-chrome.service';

describe('TripChromeService', () => {
  let service: TripChromeService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TripChromeService] });
    service = TestBed.inject(TripChromeService);
    service.registerHeight('toolbar', 56);
  });

  /**
   * Reproduit ROADMAP.md "Bugs / fixes" ("le scroll ne centre pas l'élément
   * logistique, décalage de la hauteur de la toolbar") : `getVisibleChromeHeight`
   * doit refléter la portion RÉELLEMENT visible du chrome fixe à l'instant T,
   * pas une valeur figée — `LogisticsListComponent.scrollCardToVisibleCenter`
   * s'appuie dessus pour ne pas centrer "à l'aveugle" sur une zone en partie
   * recouverte par la toolbar.
   */
  it('vaut contentTopOffset() (chrome pleinement visible) tant que rien n’a scrollé', () => {
    expect(service.getVisibleChromeHeight()).toBe(service.contentTopOffset());
  });

  it('diminue au fil du scroll, à mesure que le chrome se masque', () => {
    const full = service.getVisibleChromeHeight();

    service.setScrollTop(20);
    const partial = service.getVisibleChromeHeight();
    expect(partial).toBeLessThan(full);
    expect(partial).toBe(full - 20);

    service.setScrollTop(1000);
    expect(service.getVisibleChromeHeight()).toBeGreaterThanOrEqual(0);
    expect(service.getVisibleChromeHeight()).toBeLessThan(partial);
  });

  it("vaut toujours contentTopOffset() en 'split-pinned' (le chrome ne se masque jamais au scroll)", () => {
    service.setMode('split-pinned');
    service.setScrollTop(500);
    expect(service.getVisibleChromeHeight()).toBe(service.contentTopOffset());
  });
});
