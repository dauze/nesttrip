export interface Companion {
  uid: string;
  email: string;
  displayName?: string;
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
}
