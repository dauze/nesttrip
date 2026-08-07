/** Dépense libre (non rattachée à une activité/logement/transport, ex. un smoothie) — voir src/specs/devise.md 3.4. Toujours figée dès la saisie, pas de statut réservé/à réserver. */
export interface ExpenseFirebase {
  id: string;
  amount: number;
  currency: string;
  label: string;
  /** Epoch ms stringifié (même convention que Booking.deadline/Logistic.startDateTime). */
  date: string;
  frozenRateToEur: number;
  frozenAmountEur: number;
}
