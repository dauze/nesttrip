/**
 * Option labellisée générique (libellé + valeur + icône optionnelle) — forme commune à
 * `SelectComponent`/`SelectButtonComponent`, jusqu'ici deux interfaces structurellement
 * identiques (`SelectOption`/`SelectButtonOption`) définies séparément. Les deux composants
 * réexportent un alias vers ce type sous leur nom historique, pour ne pas casser les imports
 * existants.
 */
export interface LabeledOption<T = unknown> {
  label: string;
  value: T;
  /** Classe d'icône (PrimeIcons `pi pi-*` ou icône maison `nt-icon-*`, voir icons.scss) affichée avant le libellé. */
  icon?: string;
}
