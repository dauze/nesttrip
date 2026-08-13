import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewportService } from '@core/services/viewport.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { TripMember } from '@app/features/trips/trip.model';
import { TripHeaderComponent } from './trip-header.component';

describe('TripHeaderComponent', () => {
  const destination = signal({ ville: '', placeId: '' });
  const members = signal<Record<string, TripMember>>({});

  const tripFacadeFake = {
    getTripDestination: () => destination,
    getTripMembers: () => members,
  };

  beforeEach(() => {
    destination.set({ ville: '', placeId: '' });
    members.set({});

    // `TripHeaderComponent` monte désormais son propre `app-menu` local (voir
    // ROADMAP.md "### UI", drawer "Voyage" séparé) — `MenuComponent` injecte
    // `ViewportService`, non stubbée par défaut dans ce bac à sable de test
    // (`window.matchMedia` indisponible), même pattern que
    // `time-picker-dialog.component.spec.ts`.
    TestBed.configureTestingModule({
      imports: [TripHeaderComponent],
      providers: [
        { provide: ViewportService, useValue: { isMobile: () => false } },
        { provide: TripFacade, useValue: tripFacadeFake },
      ],
    });
  });

  /**
   * Reproduit ROADMAP.md "Bugs / fixes" ("la date n'est pas changée après la
   * sélection dans la page de résumé") : `dateRangeLabel` lisait autrefois
   * `this.dateForm.value.dates` — un getter de `FormGroup`, PAS un signal —
   * donc ce `computed()` ne suivait AUCUNE dépendance traçable et se figeait
   * pour toujours après sa première évaluation. Le header épuré (voir
   * ROADMAP.md "Le trip header doit évoluer") ne porte plus de form du tout,
   * juste `dateRange()` (signal d'entrée) directement — ce test garde la
   * couverture de la régression d'origine sur le nouveau libellé
   * "{destination} du ... au ...". Aucune destination résolue ici (`ville`
   * vide) : retombe sur le libellé fixe "Voyage" (voir `dateRangeLabel`).
   */
  it("dateRangeLabel se met à jour à chaque nouvelle valeur de dateRange() (régression : le libellé restait figé sur la première valeur)", () => {
    const fixture = TestBed.createComponent(TripHeaderComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('tripId', 'trip-1');

    fixture.componentRef.setInput('dateRange', [new Date(2026, 7, 1), new Date(2026, 7, 5)]);
    expect(component.dateRangeLabel()).toBe('Voyage du 01/08/2026 au 05/08/2026');

    fixture.componentRef.setInput('dateRange', [new Date(2026, 7, 1), new Date(2026, 7, 10)]);
    expect(component.dateRangeLabel()).toBe('Voyage du 01/08/2026 au 10/08/2026');
  });

  it('dateRangeLabel est vide tant que dateRange() est undefined', () => {
    const fixture = TestBed.createComponent(TripHeaderComponent);
    fixture.componentRef.setInput('tripId', 'trip-1');
    expect(fixture.componentInstance.dateRangeLabel()).toBe('');
  });

  /** Retour utilisateur (ROADMAP.md "### UI") : la destination principale du trip remplace le libellé fixe "Voyage" dès qu'elle est résolue. */
  it('dateRangeLabel utilise la destination principale du trip à la place de "Voyage" quand elle est connue', () => {
    destination.set({ ville: 'Bangkok', placeId: 'abc' });

    const fixture = TestBed.createComponent(TripHeaderComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('tripId', 'trip-1');
    fixture.componentRef.setInput('dateRange', [new Date(2026, 7, 1), new Date(2026, 7, 5)]);

    expect(component.dateRangeLabel()).toBe('Bangkok du 01/08/2026 au 05/08/2026');
  });

  it('companionNamesLabel liste les noms (ou emails) de tous les membres du trip', () => {
    members.set({
      u1: { role: 'owner', email: 'a@test.com', displayName: 'Alice' },
      u2: { role: 'editor', email: 'b@test.com' },
    });

    const fixture = TestBed.createComponent(TripHeaderComponent);
    fixture.componentRef.setInput('tripId', 'trip-1');

    expect(fixture.componentInstance['companionNamesLabel']()).toBe('Alice, b@test.com');
  });
});
