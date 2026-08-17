import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { OnboardingTourService } from '@app/core/onboarding/onboarding-tour.service';
import { ViewportService } from '@app/core/services/ui/viewport.service';

/** Marge (px) entre la zone découpée et le bord des panneaux grisés qui l'entourent — laisse respirer visuellement l'élément pointé plutôt qu'un cadrage pixel-perfect. */
const SPOTLIGHT_PADDING_PX = 6;

/** Espace (px) laissé entre la carte et la zone découpée en placement `anchored-above` — évite que la carte touche visuellement la zone pointée. */
const CARD_ANCHOR_GAP_PX = 12;

interface DimRects {
  top: DOMRect;
  bottom: DOMRect;
  left: DOMRect;
  right: DOMRect;
}

/** Parsing minimal du texte d'un step (voir `onboarding-sequences.ts`) : les lignes préfixées `- ` deviennent une vraie liste à puces, le reste un paragraphe d'intro. */
interface ParsedStepText {
  intro: string[];
  bullets: string[];
}

/**
 * Overlay plein écran du tour de navigation (src/specs/Parcours-new-user.md,
 * étape 3) : fond grisé découpé autour de l'ancre de l'étape courante (voir
 * `OnboardingAnchorDirective`/`OnboardingTourService.getAnchorRect`) + carte
 * flottante (Suivant/Précédent/Passer, dots de progression) positionnée selon
 * `CoachMarkStep.placement` (bas d'écran, au-dessus de la zone découpée, ou
 * centrée écran). Monté une seule fois par écran, comme
 * `SelectionActionBarComponent` — visible via `OnboardingTourService.activeStep()`.
 *
 * Le découpage utilise 4 rectangles de dimming (haut/bas/gauche/droite)
 * autour de la zone à préserver plutôt qu'un masque SVG : toutes les étapes
 * de ce tour ciblent des éléments FIXES (barre de nav, contenu déjà affiché),
 * jamais un élément qui défile pendant que la bulle est ouverte, donc pas
 * besoin d'un mécanisme plus élaboré.
 */
@Component({
  selector: 'app-coach-mark-overlay',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './coach-mark-overlay.component.html',
  styleUrl: './coach-mark-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachMarkOverlayComponent {
  protected readonly tourService = inject(OnboardingTourService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly viewport = inject(ViewportService);

  protected readonly step = this.tourService.activeStep;
  protected readonly position = this.tourService.stepPosition;
  protected readonly isFirstStep = this.tourService.isFirstStep;
  protected readonly isLastStep = this.tourService.isLastStep;

  /** `null` pour une étape sans ancre (ex. message de clôture) — voir le template, qui retombe alors sur un fond plein sans découpe. */
  private readonly spotlightRect = signal<DOMRect | null>(null);

  protected readonly dimRects = computed<DimRects | null>(() => {
    const rect = this.spotlightRect();
    if (!rect) return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = new DOMRect(0, 0, vw, Math.max(0, rect.top - SPOTLIGHT_PADDING_PX));
    const bottomTop = rect.bottom + SPOTLIGHT_PADDING_PX;
    const bottom = new DOMRect(0, bottomTop, vw, Math.max(0, vh - bottomTop));
    const middleHeight = Math.max(0, rect.height + SPOTLIGHT_PADDING_PX * 2);
    const left = new DOMRect(0, top.height, Math.max(0, rect.left - SPOTLIGHT_PADDING_PX), middleHeight);
    const rightLeft = rect.right + SPOTLIGHT_PADDING_PX;
    const right = new DOMRect(rightLeft, top.height, Math.max(0, vw - rightLeft), middleHeight);
    return { top, bottom, left, right };
  });

  protected readonly placement = computed(() => this.step()?.placement ?? 'bottom');

  /** Offset (px) depuis le bas de l'écran en placement `anchored-above` — aligne le bas de la carte juste au-dessus de la zone découpée (voir `dimRects().top`, qui s'arrête pile là où commence le spotlight). `null` hors de ce placement, ou tant que la zone découpée n'est pas encore mesurée : le template retombe alors sur le CSS par défaut (`bottom`). */
  protected readonly cardBottomOffsetPx = computed<number | null>(() => {
    if (this.placement() !== 'anchored-above') return null;
    const rects = this.dimRects();
    if (!rects) return null;
    return Math.max(0, window.innerHeight - rects.top.height + CARD_ANCHOR_GAP_PX);
  });

  /** Offset (px) depuis le haut de l'écran en placement `anchored-below` — aligne le haut de la carte juste en dessous de la zone découpée (voir `dimRects().bottom`, qui commence pile là où finit le spotlight). `null` hors de ce placement, ou tant que la zone découpée n'est pas encore mesurée. */
  protected readonly cardTopOffsetPx = computed<number | null>(() => {
    if (this.placement() !== 'anchored-below') return null;
    const rects = this.dimRects();
    if (!rects) return null;
    return rects.bottom.top + CARD_ANCHOR_GAP_PX;
  });

  /** Dots de pagination (voir le template) : plein pour l'étape courante et celles déjà passées, vide sinon — pas affiché pour une séquence à un seul step (voir `position().total`). */
  protected readonly dots = computed(() => {
    const { index, total } = this.position();
    return Array.from({ length: total }, (_, i) => i < index);
  });

  /** Découpe le texte brut d'un step (voir `onboarding-sequences.ts`) en paragraphe d'intro + puces, pour un rendu plus soigné qu'un `white-space: pre-line` brut. Les lignes commençant par `- ` deviennent des `<li>`, le reste des `<p>`. */
  protected readonly parsedText = computed<ParsedStepText>(() => {
    const lines = (this.step()?.text ?? '').split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    const intro: string[] = [];
    const bullets: string[] = [];
    for (const line of lines) {
      if (line.startsWith('- ')) bullets.push(line.slice(2));
      else intro.push(line);
    }
    return { intro, bullets };
  });

  constructor() {
    // Double rAF (même raison que ActivityDayDispatchOverlayComponent.openSheet) :
    // laisse le temps à un éventuel changement de layout déclenché par la
    // transition d'onglet/jour (qui vient de rendre l'ancre visible) de se
    // peindre avant de mesurer son rect.
    effect(() => {
      const currentStep = this.step();
      if (!currentStep) {
        this.spotlightRect.set(null);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => this.recomputeRect(currentStep.anchorIds)));
    });

    const onResize = () => {
      const currentStep = this.step();
      if (currentStep) this.recomputeRect(currentStep.anchorIds);
    };
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
  }

  private recomputeRect(anchorIds: string[]): void {
    this.spotlightRect.set(this.tourService.getAnchorRect(anchorIds));
  }

  protected onNext(): void {
    this.tourService.next();
  }

  protected onPrevious(): void {
    this.tourService.previous();
  }

  protected onSkip(): void {
    this.tourService.skip();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.step()) this.onSkip();
  }
}
