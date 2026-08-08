export interface Companion {
  uid: string;
  email: string;
  displayName?: string;
}

/** Voir `src/specs/Parcours-new-user.md` — état du parcours nouvel utilisateur, au niveau du compte (pas du trip). */
export interface OnboardingState {
  /** Vrai dès la fin de la vague immédiate du tour de navigation (étape 3) — gate l'écran d'accueil étape 1, indépendant des vagues différées (JIT) ci-dessous. */
  hasSeenOnboarding: boolean;
  /** Ids des bulles/séquences déjà vues (vague immédiate, JIT par onglet, astuce drag & drop) — permet de reprendre le tour exactement où l'utilisateur s'est arrêté si l'app est fermée en cours de route. */
  seenStepIds: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  companions: Record<string, Companion>;
  /** Préférence UI : carte du jour repliée par défaut (ROADMAP.md "### UI") — seul champ de ce document modifiable côté client, voir firestore.rules. */
  mapCollapsedByDefault?: boolean;
  /** Devise choisie explicitement par l'utilisateur dans les paramètres (roue crantée) — `undefined` tant qu'il n'a jamais rien choisi (voir `UserProfileService.defaultCurrency` pour le fallback détection locale, src/specs/devise.md 3.2). Jamais la devise pivot de calcul d'un voyage (voir 3.1) : purement la devise de CET utilisateur. */
  defaultCurrency?: string;
  /** Absent tant que l'utilisateur n'a jamais rien vu du parcours nouvel utilisateur (voir `OnboardingState`). */
  onboarding?: OnboardingState;
}
