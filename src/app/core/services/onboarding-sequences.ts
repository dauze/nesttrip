import { CoachMarkSequence, IMMEDIATE_TOUR_ID } from './onboarding-tour.service';

/**
 * Séquences du tour de navigation (src/specs/Parcours-new-user.md, étape 3) —
 * mobile uniquement (voir `ViewportService.isMobileChrome`). Les ids d'ancre
 * référencés ici sont posés via `OnboardingAnchorDirective`, principalement
 * sur `MobileTripNavComponent`. `'content-area'` est un cas particulier : pas
 * un élément visuel propre à un écran, mais une ancre synthétique posée par
 * `TripDetailComponent` qui couvre tout l'écran SAUF la toolbar et la barre de
 * nav mobile (voir son template) — utilisée par toute bulle qui doit désigner
 * "le contenu affiché" en général, quel que soit l'onglet/jour actif.
 */

/** Vague immédiate, à l'arrivée sur l'écran (2 bulles + message de clôture sans spotlight) — sa fin pose `hasSeenOnboarding` (voir OnboardingTourService.next). */
export const IMMEDIATE_TOUR: CoachMarkSequence = {
  id: IMMEDIATE_TOUR_ID,
  steps: [
    {
      id: 'onboarding-immediate-1',
      // Ancre restreinte à la barre Général/Jour N (pas tout `.mobile-trip-nav`,
      // qui inclut aussi la bande de chips des jours au-dessus) : le texte de
      // cette bulle ne parle que des 2 boutons, la découpe ne doit montrer que ça.
      anchorIds: ['mobile-nav-bar-primary'],
      placement: 'anchored-above',
      text: 'Ton voyage se pilote de <strong>2 façons</strong> : \n  - <strong>Général</strong>, pour le voir par thèmatique \n  - <strong>Jour 1</strong>, pour le voir jour par jour',
    },
    {
      id: 'onboarding-immediate-2',
      anchorIds: ['content-area'],
      placement: 'center',
      text: 'Tu es sur l\'onglet <strong>Résumé</strong>, qui affiche un <strong>aperçu</strong>, le <strong>budget</strong>, le <strong>pense-bête de réservations</strong> et les <strong>pieces jointes</strong>. \n À côté, <strong>3</strong> autres thèmes de <strong>Général</strong> : \n  - Activités \n  - Logement & Transport \n  - Listes',
    },
    {
      id: 'onboarding-immediate-closing',
      anchorIds: [],
      text: 'Let\'s go !',
      placement: 'center',
      primaryLabel: "C'est parti !",
    },
  ],
};

export const ACTIVITIES_INTRO: CoachMarkSequence = {
  id: 'activities-intro',
  steps: [
    {
      id: 'onboarding-activities-intro',
      anchorIds: ['content-area'],
      placement: 'center',
      text: "Crée <strong>ici</strong> des activités sans date (tu pourras les placer sur un jour plus tard depuis cet écran), <strong>ou</strong> crée-les directement sur le jour choisi dans le menu <strong>Jour 1</strong>. \n <strong>Astuce</strong> : reste appuyé sur une carte pour la supprimer.",
    },
  ],
};

export const LOGISTICS_INTRO: CoachMarkSequence = {
  id: 'logistics-intro',
  steps: [
    {
      id: 'onboarding-logistics-intro',
      anchorIds: ['content-area'],
      placement: 'center',
      text: 'Même fonctionnement que les activités : crée-les logements et transports ici <strong>ou</strong> sur un jour, tu les retrouveras <strong>aux deux endroits</strong>.',
    },
  ],
};

export const NOTES_INTRO: CoachMarkSequence = {
  id: 'notes-intro',
  steps: [
    {
      id: 'onboarding-notes-intro',
      anchorIds: ['content-area'],
      placement: 'center',
      text: "Crée ici des <strong>listes</strong> : ce qu'il faut emporter, ou des <strong>tips</strong> liés à une activité précise (tu peux les relier).",
    },
  ],
};

/** Sous-séquence différée déclenchée au 1er clic sur un tab de jour (3 bulles). */
export const DAY_NAV_TOUR: CoachMarkSequence = {
  id: 'day-nav-tour',
  steps: [
    {
      id: 'onboarding-day-nav-1',
      anchorIds: ['mobile-day-strip'],
      placement: 'anchored-above',
      text: 'Navigue entre les <strong>jours</strong> ici, en swipant et en cliquant directement sur une date.',
    },
    {
      id: 'onboarding-day-nav-2',
      anchorIds: ['mobile-day-badge'],
      placement: 'anchored-above',
      text: 'Navigue entre les jours plus <strong>rapidement</strong> par ici, en <strong>double tappant</strong> sur le bouton <strong>Jour 1</strong>.',
    },
    {
      id: 'onboarding-day-nav-3',
      anchorIds: ['content-area'],
      placement: 'center',
      text: 'Ici tu trouveras le <strong>déroulé</strong> de ta journée avec tes activités, tes logements et tes transports rangés <strong>chronologiquement</strong>.',
    },
  ],
};

/** Étape 4 (hors tour de navigation) : pas un `CoachMarkSequence` (pas de spotlight plein écran), juste un id à marquer vu — voir `TripActivitiesCreationService`. */
export const DRAG_HINT_STEP_ID = 'onboarding-drag-hint';
