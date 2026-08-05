export interface TripTab {
  id: string;
  label: string;
  /** Chiffre du jour (ex. "22"), absent pour les tabs Activités/Logistique/Listes — même critère que `TripTabsNavComponent`/`MobileTripNavComponent` pour distinguer un tab de jour d'un tab général. */
  dayNumber?: string;
  /** Jour de semaine abrégé (ex. "mer."), absent pour les tabs Activités/Logistique/Listes. */
  weekday?: string;
  /** Jour de semaine complet (ex. "mercredi"), affiché à la place de l'abrégé quand l'onglet est assez large. */
  weekdayFull?: string;
  /** Mois abrégé (ex. "juil."), absent pour les tabs Activités/Logistique/Listes. */
  month?: string;
  /** Mois complet (ex. "juillet"), affiché à la place de l'abrégé quand l'onglet est assez large. */
  monthFull?: string;
}
