import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface RingChartEntry {
  label: string;
  icon: string;
  /** Variable CSS (`--nt-activity-*`/`--nt-logistic-*`, voir tokens.scss). */
  colorVar: string;
  /** Valeur brute de cette entrée (nombre d'éléments pour `typeBreakdown`, montant pour `expenseBreakdown`) — sert de repli pour la légende/bulle si `valueLabel` n'est pas fourni, et à l'`aria-label` du graphique. */
  count: number;
  /** Texte affiché à la place de `count` tel quel (ex. "45.00 €" pour une dépense) — `TripSummaryComponent.expenseBreakdown`. Repli sur `count` si absent (ex. `typeBreakdown`, un simple nombre d'éléments). */
  valueLabel?: string;
  /** Part de `count` dans le total (TOUTES catégories/dépenses confondues, pas seulement le top affiché) — voir `TripSummaryComponent.typeBreakdown`/`expenseBreakdown`. */
  share: number;
}

interface RingGeometry extends RingChartEntry {
  radius: number;
  circumference: number;
  dashArray: string;
  /** Coordonnées du milieu de l'arc rempli, dans le repère ABSOLU du `<svg>` (pas celui, tourné -90°, du `<g>` qui dessine les pistes/arcs) — voir `bubbleAngleDeg` dans `rings`. Sert d'ancrage à la zone de tap invisible + à la bulle de détail (mode `interactive`), aucune icône n'est plus posée sur l'anneau lui-même (retour utilisateur : trop petites/superposées) — l'icône ne vit plus que dans la légende, voir le template. */
  bubbleX: number;
  bubbleY: number;
  /** `share` formatée en pourcentage entier (ex. "24%") — calculé ici plutôt que via un pipe dans le template pour ne pas avoir à importer `DecimalPipe` dans ce composant sans autre pipe/directive. */
  sharePercentLabel: string;
}

/** Mode legend (`typeBreakdown`) : anneaux serrés/fins, priorité à la taille du dessin. Mode `interactive` (`expenseBreakdown`, montant centré + légende sous l'anneau) : anneaux plus fins/espacés pour laisser un centre assez grand pour le montant — plus besoin d'agrandir/épaissir pour accueillir des icônes sur l'anneau (retirées, voir doc de classe). */
const GEOMETRY = {
  legend: { outerRadius: 68, ringStep: 13, strokeWidth: 9, viewBoxSize: 176 },
  interactive: { outerRadius: 72, ringStep: 11, strokeWidth: 9, viewBoxSize: 168 },
};

/**
 * Anneaux concentriques génériques (ROADMAP.md "### UI", Résumé) — un anneau
 * par entrée, longueur d'arc proportionnelle à sa part du total. Inspiré des
 * anneaux d'activité façon montre connectée, MAIS chaque anneau représente
 * ici une catégorie/valeur différente (pas la progression d'une même
 * métrique) — voir `public/graphisme.png` (référence visuelle fournie par
 * l'utilisateur). Deux usages dans ce trip (`TripSummaryComponent`, nom du
 * composant resté `activity-type-rings` pour l'historique) :
 * - `typeBreakdown` (top 5 types d'activité/transport/logement, tuile
 *   "Résumé" à l'origine) : mode legend classique (`interactive` à `false`,
 *   défaut), légende texte permanente sous l'anneau, pas de centre.
 * - `expenseBreakdown` (dépenses, tuile "Dépenses") : `interactive` à `true`
 *   (src/specs/devise.md 3.5) — montant total projeté au centre via
 *   `<ng-content select="[ringsCenter]">` (mis en forme par l'appelant, ce
 *   composant reste agnostique du formatage devise), légende compacte sous
 *   l'anneau (icône/nom/montant/% de CHAQUE part, retour utilisateur : plus
 *   besoin de taper pour lire les montants — voir `.rings-chart__interactive-legend`
 *   dans le template) ; aucune icône n'est posée sur l'anneau lui-même
 *   (retirées, retour utilisateur : trop petites/superposées sur les petits
 *   segments). Taper une part de l'anneau OU sa ligne de légende ouvre/ferme
 *   une bulle de détail (libellé + montant) au même endroit sur l'arc, qui se
 *   ferme au tap ailleurs (y compris en dehors du composant, voir le listener
 *   document dans le constructeur) — vestige utile pour situer visuellement
 *   une ligne de légende sur l'anneau, plus nécessaire pour lire la valeur.
 *
 * SVG pur (pas de librairie de graphique) : piste grise fixe + arc coloré
 * par `stroke-dasharray`, un seul `<svg>` avec un cercle par anneau, tourné
 * de -90° pour démarrer à midi (voir le template) — mais les coordonnées de
 * bulle/icône (`bubbleX`/`bubbleY`) sont calculées dans le repère ABSOLU
 * (donc rendues hors du `<g>` tourné) pour que le texte de la bulle reste
 * lisible à l'endroit, sans contre-rotation.
 */
@Component({
  selector: 'app-activity-type-rings',
  standalone: true,
  templateUrl: './activity-type-rings.component.html',
  styleUrl: './activity-type-rings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTypeRingsComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly entries = input.required<RingChartEntry[]>();
  readonly interactive = input(false);

  private readonly geometry = computed(() => (this.interactive() ? GEOMETRY.interactive : GEOMETRY.legend));

  protected readonly viewBoxSize = computed(() => this.geometry().viewBoxSize);
  protected readonly center = computed(() => this.geometry().viewBoxSize / 2);
  protected readonly strokeWidth = computed(() => this.geometry().strokeWidth);

  protected readonly selectedIndex = signal<number | null>(null);

  protected readonly rings = computed<RingGeometry[]>(() => {
    const geometry = this.geometry();
    const center = this.center();

    return this.entries().map((entry, i) => {
      const radius = geometry.outerRadius - i * geometry.ringStep;
      const circumference = 2 * Math.PI * radius;
      const share = Math.max(0, Math.min(1, entry.share));
      const filled = share * circumference;
      // Milieu de l'arc rempli : chaque anneau démarre à midi (-90° avant
      // rotation du `<g>`, voir le template) et balaie `share * 360°` en
      // sens horaire — le milieu est donc à la moitié de ce balayage.
      const bubbleAngleDeg = -90 + share * 180;
      const bubbleAngleRad = (bubbleAngleDeg * Math.PI) / 180;
      const bubbleX = center + radius * Math.cos(bubbleAngleRad);
      const bubbleY = center + radius * Math.sin(bubbleAngleRad);

      return {
        ...entry,
        radius,
        circumference,
        dashArray: `${filled} ${circumference}`,
        bubbleX,
        bubbleY,
        sharePercentLabel: `${Math.round(share * 100)}%`,
      };
    });
  });

  constructor() {
    afterNextRender(() => {
      const onDocumentPointerDown = (event: PointerEvent) => {
        if (this.selectedIndex() === null) return;
        if (this.elementRef.nativeElement.contains(event.target as Node)) return;
        this.selectedIndex.set(null);
      };
      document.addEventListener('pointerdown', onDocumentPointerDown, true);
      this.destroyRef.onDestroy(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true));
    });
  }

  protected toggleSlice(index: number, event: Event): void {
    event.stopPropagation();
    this.selectedIndex.update((current) => (current === index ? null : index));
  }
}
