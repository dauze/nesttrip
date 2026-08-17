import { TestBed } from '@angular/core/testing';
import { CoachMarkSequence, IMMEDIATE_TOUR_ID, OnboardingTourService } from './onboarding-tour.service';
import { UserProfileService } from '@core/services/business/user-profile.service';

function makeSequence(id: string, stepIds: string[]): CoachMarkSequence {
  return { id, steps: stepIds.map((stepId) => ({ id: stepId, anchorIds: [], text: stepId })) };
}

function makeAnchorEl(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect;
  return el;
}

describe('OnboardingTourService', () => {
  let service: OnboardingTourService;
  let seenStepIds: Set<string>;
  let markOnboardingStepSeen: ReturnType<typeof vi.fn>;
  let completeOnboardingIntro: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    seenStepIds = new Set<string>();
    markOnboardingStepSeen = vi.fn((id: string) => seenStepIds.add(id));
    completeOnboardingIntro = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        OnboardingTourService,
        {
          provide: UserProfileService,
          useValue: {
            isOnboardingStepSeen: (id: string) => seenStepIds.has(id),
            markOnboardingStepSeen,
            completeOnboardingIntro,
          },
        },
      ],
    });

    service = TestBed.inject(OnboardingTourService);
  });

  it('démarre une séquence jamais vue et expose son 1er step', () => {
    const sequence = makeSequence('activities-intro', ['step-1']);
    service.start(sequence);

    expect(service.activeStep()?.id).toBe('step-1');
    expect(service.stepPosition()).toEqual({ index: 1, total: 1 });
  });

  it('ne démarre rien si tous les steps de la séquence sont déjà vus', () => {
    seenStepIds.add('step-1');
    service.start(makeSequence('activities-intro', ['step-1']));

    expect(service.activeStep()).toBeNull();
  });

  it("reprend une séquence interrompue : ne présente que les steps jamais vus (spec, 'Points particulier')", () => {
    seenStepIds.add('day-nav-1');
    service.start(makeSequence('day-nav-tour', ['day-nav-1', 'day-nav-2', 'day-nav-3']));

    expect(service.activeStep()?.id).toBe('day-nav-2');
    expect(service.isFirstStep()).toBe(true);
  });

  it("n'empile jamais 2 séquences : start() est no-op si une séquence tourne déjà", () => {
    service.start(makeSequence('activities-intro', ['step-1']));
    service.start(makeSequence('logistics-intro', ['step-2']));

    expect(service.activeStep()?.id).toBe('step-1');
  });

  it('next() marque le step courant vu et avance au suivant', () => {
    service.start(makeSequence('day-nav-tour', ['step-1', 'step-2']));

    service.next();

    expect(markOnboardingStepSeen).toHaveBeenCalledWith('step-1');
    expect(service.activeStep()?.id).toBe('step-2');
    expect(service.isLastStep()).toBe(true);
  });

  it('next() sur le dernier step termine la séquence sans poser hasSeenOnboarding (séquence non-immédiate)', () => {
    service.start(makeSequence('logistics-intro', ['step-1']));

    service.next();

    expect(markOnboardingStepSeen).toHaveBeenCalledWith('step-1');
    expect(completeOnboardingIntro).not.toHaveBeenCalled();
    expect(service.activeStep()).toBeNull();
  });

  it('next() sur le dernier step de la vague immédiate pose hasSeenOnboarding', () => {
    service.start({ id: IMMEDIATE_TOUR_ID, steps: [{ id: 'immediate-1', anchorIds: [], text: 'a' }] });

    service.next();

    expect(completeOnboardingIntro).toHaveBeenCalled();
  });

  it('previous() recule sans jamais descendre sous le 1er step', () => {
    service.start(makeSequence('day-nav-tour', ['step-1', 'step-2']));
    service.next();
    expect(service.isFirstStep()).toBe(false);

    service.previous();
    expect(service.activeStep()?.id).toBe('step-1');

    service.previous();
    expect(service.activeStep()?.id).toBe('step-1');
  });

  it('skip() marque TOUS les steps de la séquence vus (pas seulement le step affiché) et referme le tour', () => {
    service.start(makeSequence('day-nav-tour', ['step-1', 'step-2', 'step-3']));

    service.skip();

    expect(markOnboardingStepSeen).toHaveBeenCalledWith('step-1');
    expect(markOnboardingStepSeen).toHaveBeenCalledWith('step-2');
    expect(markOnboardingStepSeen).toHaveBeenCalledWith('step-3');
    expect(service.activeStep()).toBeNull();
  });

  it('skip() sur la vague immédiate pose aussi hasSeenOnboarding', () => {
    service.start({ id: IMMEDIATE_TOUR_ID, steps: [{ id: 'a', anchorIds: [], text: 'a' }, { id: 'b', anchorIds: [], text: 'b' }] });

    service.skip();

    expect(completeOnboardingIntro).toHaveBeenCalled();
  });

  it("start() ne rouvre pas une séquence skip()ée même si isOnboardingStepSeen n'a pas encore rattrapé l'écriture Firestore (course avec l'effect de déclenchement, voir TripDetailComponent/activeTrip qui recompose une nouvelle référence à chaque mutation)", () => {
    const sequence = makeSequence('activities-intro', ['step-1']);
    service.start(sequence);
    service.skip();

    // Écriture Firestore fire-and-forget pas encore reflétée localement.
    seenStepIds.clear();

    service.start(sequence);

    expect(service.activeStep()).toBeNull();
  });

  it('start() ne rouvre pas une séquence terminée via next() sur le dernier step, même course', () => {
    const sequence = makeSequence('day-nav-tour', ['step-1']);
    service.start(sequence);
    service.next();

    seenStepIds.clear();

    service.start(sequence);

    expect(service.activeStep()).toBeNull();
  });

  it('getAnchorRect renvoie la bounding box englobant toutes les ancres demandées', () => {
    const left = makeAnchorEl({ left: 0, top: 10, right: 50, bottom: 30, width: 50, height: 20 });
    const right = makeAnchorEl({ left: 100, top: 0, right: 150, bottom: 40, width: 50, height: 40 });
    service.registerAnchor('left', left);
    service.registerAnchor('right', right);

    const rect = service.getAnchorRect(['left', 'right']);

    expect(rect).toEqual(expect.objectContaining({ left: 0, top: 0, right: 150, bottom: 40 }));
  });

  it('getAnchorRect renvoie null si aucune ancre demandée n\'est enregistrée', () => {
    expect(service.getAnchorRect(['unknown'])).toBeNull();
  });

  it('unregisterAnchor retire bien une ancre du calcul', () => {
    const el = makeAnchorEl({ left: 0, top: 0, right: 10, bottom: 10 });
    service.registerAnchor('a', el);
    service.unregisterAnchor('a', el);

    expect(service.getAnchorRect(['a'])).toBeNull();
  });
});
