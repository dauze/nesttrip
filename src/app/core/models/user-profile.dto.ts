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
}
