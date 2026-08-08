import { Injectable, computed, inject, signal } from '@angular/core';
import { UserProfileService } from './user-profile.service';

/** Id de séquence de la vague immédiate (voir `onboarding-sequences.ts`) — sert de repère ici pour poser `hasSeenOnboarding` dès sa fin (spec, étape 3). */
export const IMMEDIATE_TOUR_ID = 'immediate-tour';

export interface CoachMarkStep {
  /** Id STABLE de cette bulle précise (pas seulement de la séquence) — c'est lui qui est stocké dans `seenStepIds`, ce qui permet de reprendre une séquence interrompue bulle par bulle plutôt que de la rejouer entièrement. */
  id: string;
  /** Éléments enregistrés via `OnboardingAnchorDirective` à découper dans le fond grisé — vide pour une bulle "flottante" sans spotlight (ex. message de clôture). */
  anchorIds: string[];
  text: string;
  /** Libellé du bouton principal SEULEMENT sur le dernier step d'une séquence (ex. "C'est parti !" pour la vague immédiate) — "Terminer" par défaut sinon. */
  primaryLabel?: string;
  /**
   * Position de la bulle (voir `CoachMarkOverlayComponent`) — `'bottom'`
   * (défaut, feuille ancrée en bas d'écran) convient à une ancre déjà proche
   * du bas (ex. la barre de nav elle-même) ; `'anchored-above'` la décale
   * juste au-dessus de la zone découpée (pour une ancre plus haute, où un
   * ancrage bas laisserait un grand vide entre la zone pointée et la bulle) ;
   * `'anchored-below'` la décale juste EN DESSOUS de la zone découpée (même
   * logique qu'`'anchored-above'`, inversée — pour une ancre proche du haut
   * d'écran, où la bulle a plus de place en dessous qu'au-dessus) ; `'center'`
   * l'affiche centrée écran (ancre large couvrant tout le contenu, ou bulle
   * sans ancre comme un message de clôture).
   */
  placement?: 'bottom' | 'anchored-above' | 'anchored-below' | 'center';
}

export interface CoachMarkSequence {
  id: string;
  steps: CoachMarkStep[];
}

interface ActiveSequenceState {
  sequence: CoachMarkSequence;
  /** Steps restants à afficher, déjà filtrés des ids vus par `start()` — la reprise saute directement aux bulles jamais vues, sans champ d'index à part. */
  steps: CoachMarkStep[];
}

/**
 * Pilote QUELLE séquence de coach marks (voir src/specs/Parcours-new-user.md,
 * étape 3) est active à l'instant T — une seule à la fois, jamais deux tours
 * empilés (`start()` est no-op si une séquence tourne déjà). Fourni au niveau
 * `/trips` (comme `UserProfileService`, dont il dépend), pas root — l'état de
 * ce service n'a de sens que dans ce sous-arbre de routes.
 */
@Injectable()
export class OnboardingTourService {
  private readonly userProfileService = inject(UserProfileService);

  private readonly state = signal<ActiveSequenceState | null>(null);
  private readonly stepIndex = signal(0);

  readonly activeStep = computed<CoachMarkStep | null>(() => this.state()?.steps[this.stepIndex()] ?? null);
  readonly stepPosition = computed(() => ({ index: this.stepIndex() + 1, total: this.state()?.steps.length ?? 0 }));
  readonly isFirstStep = computed(() => this.stepIndex() === 0);
  readonly isLastStep = computed(() => this.stepIndex() >= (this.state()?.steps.length ?? 1) - 1);

  /**
   * Séquences skip()/terminées CETTE session (voir `close()`) — protège contre
   * un ré-affichage immédiat causé par `TripFacade.activeTrip()`, qui recompose
   * une NOUVELLE référence `Trip` à chaque mutation (voir CLAUDE.md) : les
   * effects de déclenchement (`TripDetailComponent`, ex. la vague immédiate au
   * retour sur Résumé) tournent alors à nouveau et rappellent `start()` AVANT
   * que l'écriture Firestore de fin de séquence (`markOnboardingStepSeen`/
   * `completeOnboardingIntro`, fire-and-forget) n'ait eu le temps de se
   * refléter dans `UserProfileService.profile()` — sans ce garde, `start()`
   * relisait un `isOnboardingStepSeen` encore périmé et rouvrait la bulle
   * qu'on venait tout juste de fermer (repro : "Passer"/bouton de fin sans
   * effet visible). Repose en mémoire (pas persisté) : suffisant pour couvrir
   * la fenêtre de course, la persistance Firestore prend ensuite le relai de
   * façon durable (y compris après reload).
   */
  private readonly dismissedSequenceIds = new Set<string>();

  private readonly anchors = new Map<string, HTMLElement>();

  registerAnchor(id: string, el: HTMLElement): void {
    this.anchors.set(id, el);
  }

  unregisterAnchor(id: string, el: HTMLElement): void {
    if (this.anchors.get(id) === el) this.anchors.delete(id);
  }

  /** Bounding box englobant TOUTES les ancres demandées — pour une bulle qui pointe simultanément 2 zones contiguës (ex. sous-onglets + contenu Résumé), une seule zone rectangulaire suffit plutôt qu'un vrai découpage multi-formes. */
  getAnchorRect(ids: string[]): DOMRect | null {
    const rects = ids
      .map((id) => this.anchors.get(id)?.getBoundingClientRect())
      .filter((rect): rect is DOMRect => !!rect);
    if (rects.length === 0) return null;

    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return new DOMRect(left, top, right - left, bottom - top);
  }

  /** Point d'entrée unique de toutes les séquences (vague immédiate, JIT par onglet, sous-séquence jour) — no-op si déjà entièrement vue ou si une séquence tourne déjà. */
  start(sequence: CoachMarkSequence): void {
    if (this.state() || this.dismissedSequenceIds.has(sequence.id)) return;
    const steps = sequence.steps.filter((step) => !this.userProfileService.isOnboardingStepSeen(step.id));
    if (steps.length === 0) return;
    this.state.set({ sequence, steps });
    this.stepIndex.set(0);
  }

  next(): void {
    const current = this.state();
    if (!current) return;
    this.userProfileService.markOnboardingStepSeen(current.steps[this.stepIndex()].id);

    if (!this.isLastStep()) {
      this.stepIndex.update((i) => i + 1);
      return;
    }

    if (current.sequence.id === IMMEDIATE_TOUR_ID) this.userProfileService.completeOnboardingIntro();
    this.close();
  }

  previous(): void {
    this.stepIndex.update((i) => Math.max(0, i - 1));
  }

  /** Lien "Passer" — dismiss l'intégralité de la séquence en cours (pas seulement la bulle affichée), pour ne plus jamais la revoir. */
  skip(): void {
    const current = this.state();
    if (!current) return;
    for (const step of current.sequence.steps) this.userProfileService.markOnboardingStepSeen(step.id);
    if (current.sequence.id === IMMEDIATE_TOUR_ID) this.userProfileService.completeOnboardingIntro();
    this.close();
  }

  private close(): void {
    const current = this.state();
    if (current) this.dismissedSequenceIds.add(current.sequence.id);
    this.state.set(null);
    this.stepIndex.set(0);
  }
}
