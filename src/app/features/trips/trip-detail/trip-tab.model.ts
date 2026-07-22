export interface TripTab {
  id: string;
  label: string;
  /** Chiffre du jour (ex. "22"), absent pour l'onglet "Général". */
  dayNumber?: string;
  /** Jour de semaine abrégé (ex. "mer."), absent pour l'onglet "Général". */
  weekday?: string;
  /** Jour de semaine complet (ex. "mercredi"), affiché à la place de l'abrégé quand l'onglet est assez large. */
  weekdayFull?: string;
  /** Mois abrégé (ex. "juil."), absent pour l'onglet "Général". */
  month?: string;
  /** Mois complet (ex. "juillet"), affiché à la place de l'abrégé quand l'onglet est assez large. */
  monthFull?: string;
}