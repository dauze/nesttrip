import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GoogleMapPanelService } from './google-map-panel.service';
import { UserProfileService } from './user-profile.service';

describe('GoogleMapPanelService', () => {
  let mapCollapsedByDefault: ReturnType<typeof signal<boolean | undefined>>;
  let setMapCollapsedByDefault: ReturnType<typeof vi.fn>;
  let service: GoogleMapPanelService;

  beforeEach(() => {
    mapCollapsedByDefault = signal<boolean | undefined>(undefined);
    setMapCollapsedByDefault = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        GoogleMapPanelService,
        {
          provide: UserProfileService,
          useValue: {
            mapCollapsedByDefault,
            setMapCollapsedByDefault,
          },
        },
      ],
    });

    service = TestBed.inject(GoogleMapPanelService);
  });

  it("reste à false tant que la préférence Firestore n'est pas encore connue", () => {
    TestBed.tick();
    expect(service.isCollapsed()).toBe(false);
  });

  /**
   * Reproduit le scénario du bug (ROADMAP.md "Bugs / fixes", "la
   * récupération du flag pour savoir si la carte doit être ouverte ou
   * fermée ne fonctionne pas") : la préférence Firestore arrive de façon
   * ASYNCHRONE, après le premier rendu — tant que rien n'appelle
   * `setCollapse()` avant qu'elle arrive (voir `TripDayMapComponent`,
   * corrigé pour ne plus le faire), elle doit bien s'appliquer dès qu'elle
   * est connue.
   */
  it("applique la préférence Firestore dès qu'elle arrive, même après le premier rendu", () => {
    TestBed.tick();
    expect(service.isCollapsed()).toBe(false);

    mapCollapsedByDefault.set(true);
    TestBed.tick();

    expect(service.isCollapsed()).toBe(true);
  });

  it("n'écrase pas une préférence Firestore chargée entre-temps si l'utilisateur bascule manuellement avant qu'elle arrive", () => {
    // Bascule manuelle (clic utilisateur réel, via `setCollapse`) avant que
    // la préférence Firestore ne soit connue.
    service.setCollapse(true);
    expect(setMapCollapsedByDefault).toHaveBeenCalledWith(true);

    // La préférence Firestore arrive ENSUITE, avec une valeur différente :
    // ne doit PAS écraser le choix explicite déjà fait dans cette session
    // (voir la doc de `seeded`).
    mapCollapsedByDefault.set(false);
    TestBed.tick();

    expect(service.isCollapsed()).toBe(true);
  });

  it('toggleCollapse alterne bien la valeur courante et persiste', () => {
    TestBed.tick();
    expect(service.isCollapsed()).toBe(false);

    service.toggleCollapse();
    expect(service.isCollapsed()).toBe(true);
    expect(setMapCollapsedByDefault).toHaveBeenCalledWith(true);

    service.toggleCollapse();
    expect(service.isCollapsed()).toBe(false);
    expect(setMapCollapsedByDefault).toHaveBeenCalledWith(false);
  });
});
