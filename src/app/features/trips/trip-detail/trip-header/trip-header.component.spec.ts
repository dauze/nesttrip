import { TestBed } from '@angular/core/testing';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { TripHeaderComponent } from './trip-header.component';

describe('TripHeaderComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TripHeaderComponent],
      providers: [
        { provide: DialogService, useValue: { open: vi.fn() } },
        // `<app-date-picker>` (template) injecte `ViewportService`, qui
        // appelle `window.matchMedia` (non polyfillé dans cet environnement
        // de test) — `TestBed.createComponent` instancie déjà les enfants de
        // template en mode création, avant même le premier `detectChanges()`.
        {
          provide: ViewportService,
          useValue: {
            isMobile: () => false,
            isSplitLayout: () => true,
            isChromePinned: () => true,
            isTouchDevice: () => false,
            isMobileChrome: () => false,
          },
        },
      ],
    });
  });

  /**
   * Reproduit ROADMAP.md "Bugs / fixes" ("la date n'est pas changée après la
   * sélection dans la page de résumé") : `dateRangeLabel` lisait
   * `this.dateForm.value.dates` — un getter de `FormGroup`, PAS un signal —
   * donc ce `computed()` ne suivait AUCUNE dépendance traçable et se figeait
   * pour toujours après sa première évaluation, quel que soit le nombre de
   * fois où le form était repatché ensuite (sélection utilisateur ou
   * changement distant via `dateRange()`).
   */
  it("dateRangeLabel se met à jour à chaque nouvelle valeur de dateRange() (régression : le libellé restait figé sur la première valeur)", () => {
    const fixture = TestBed.createComponent(TripHeaderComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('dateRange', [new Date(2026, 7, 1), new Date(2026, 7, 5)]);
    expect(component.dateRangeLabel()).toBe('01/08/2026 - 05/08/2026');

    fixture.componentRef.setInput('dateRange', [new Date(2026, 7, 1), new Date(2026, 7, 10)]);
    expect(component.dateRangeLabel()).toBe('01/08/2026 - 10/08/2026');
  });

  it('dateRangeLabel est vide tant que dateRange() est undefined', () => {
    const fixture = TestBed.createComponent(TripHeaderComponent);
    expect(fixture.componentInstance.dateRangeLabel()).toBe('');
  });
});
