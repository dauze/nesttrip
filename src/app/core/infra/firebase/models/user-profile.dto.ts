export interface CompanionFirebase {
  uid: string;
  email: string;
  displayName?: string | null;
}

export interface UserProfileFirebase {
  uid: string;
  email: string;
  displayName?: string | null;
  companions: Record<string, CompanionFirebase>;
  /** Voir `UserProfile.mapCollapsedByDefault` — seul champ de ce document modifiable côté client (firestore.rules). */
  mapCollapsedByDefault?: boolean;
  /** Voir `UserProfile.defaultCurrency` — champ client-writable (firestore.rules), voir src/specs/devise.md 3.2. */
  defaultCurrency?: string;
}
