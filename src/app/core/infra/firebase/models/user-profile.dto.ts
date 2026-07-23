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
}
