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
}
