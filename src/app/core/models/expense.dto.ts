/** Dépense libre (non rattachée à une activité/logement/transport, ex. un smoothie) — voir src/specs/devise.md 3.4. */
export interface Expense {
  id: string;
  amount: number;
  currency: string;
  label: string;
  date: Date;
  /** Taux devise -> EUR figé au moment de la saisie (toujours renseigné, pas de statut réservé/à réserver pour une dépense libre — pivot technique interne, voir currency-conversion.service.ts). */
  frozenRateToEur: number;
  /** Montant converti en EUR au moment de la saisie (voir frozenRateToEur). */
  frozenAmountEur: number;
}
