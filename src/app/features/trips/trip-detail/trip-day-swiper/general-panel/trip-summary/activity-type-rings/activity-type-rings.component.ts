import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RingChartEntry {
  label: string;
  icon: string;
  /** Variable CSS (`--nt-activity-*`/`--nt-logistic-*`, voir tokens.scss). */
  colorVar: string;
  /** Valeur brute de cette entrée (nombre d'éléments pour `typeBreakdown`, montant pour `expenseBreakdown`) — sert de repli pour la légende si `valueLabel` n'est pas fourni, et à l'`aria-label` du graphique. */
  count: number;
  /** Texte affiché dans la légende à la place de `count` tel quel (ex. "45.00 €" pour une dépense) — `TripSummaryComponent.expenseBreakdown`. Repli sur `count` si absent (ex. `typeBreakdown`, un simple nombre d'éléments). */
  valueLabel?: string;
  /** Part de `count` dans le total (TOUTES catégories/dépenses confondues, pas seulement le top affiché) — voir `TripSummaryComponent.typeBreakdown`/`expenseBreakdown`. */
  share: number;
}

interface RingGeometry extends RingChartEntry {
  radius: number;
  circumference: number;
  dashArray: string;
}

const VIEWBOX_SIZE = 176;
const CENTER = VIEWBOX_SIZE / 2;
const OUTER_RADIUS = 68;
const STROKE_WIDTH = 9;
const RING_STEP = 13;

/**
 * Anneaux concentriques génériques (ROADMAP.md "### UI", Résumé) — un anneau
 * par entrée, longueur d'arc proportionnelle à sa part du total. Inspiré des
 * anneaux d'activité façon montre connectée, MAIS chaque anneau représente
 * ici une catégorie/valeur différente (pas la progression d'une même
 * métrique) — voir `public/graphisme.png` (référence visuelle fournie par
 * l'utilisateur). Deux usages dans ce trip (`TripSummaryComponent`, nom du
 * composant resté `activity-type-rings` pour l'historique) : `typeBreakdown`
 * (top 5 types d'activité/transport/logement, tuile "Résumé" à l'origine) et
 * `expenseBreakdown` (top 4 plus grosses dépenses + "Autre", tuile
 * "Dépenses", 2026-08-05) — `count`/`valueLabel` portent alors un MONTANT
 * plutôt qu'un nombre d'éléments, voir la doc de `RingChartEntry`.
 *
 * SVG pur (pas de librairie de graphique) : piste grise fixe + arc coloré
 * par `stroke-dasharray`, un seul `<svg>` avec un cercle par anneau, tourné
 * de -90° pour démarrer à midi (voir le template).
 */
@Component({
  selector: 'app-activity-type-rings',
  standalone: true,
  templateUrl: './activity-type-rings.component.html',
  styleUrl: './activity-type-rings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTypeRingsComponent {
  readonly entries = input.required<RingChartEntry[]>();

  protected readonly viewBoxSize = VIEWBOX_SIZE;
  protected readonly center = CENTER;
  protected readonly strokeWidth = STROKE_WIDTH;

  protected readonly rings = computed<RingGeometry[]>(() =>
    this.entries().map((entry, i) => {
      const radius = OUTER_RADIUS - i * RING_STEP;
      const circumference = 2 * Math.PI * radius;
      const filled = Math.max(0, Math.min(1, entry.share)) * circumference;
      return {
        ...entry,
        radius,
        circumference,
        dashArray: `${filled} ${circumference}`,
      };
    }),
  );
}
