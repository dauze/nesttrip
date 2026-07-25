import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';

/** Durée pendant laquelle le bouton reste élargi après un tap (pas de :hover sur tactile). */
const TAP_PULSE_DURATION_MS = 900;

/**
 * Bouton "+" flottant, vrai `position: fixed` (bottom-right de l'écran).
 * Doit être monté HORS du swiper de jours : un `swiper-slide` applique un
 * `transform` permanent (positionnement horizontal des slides), ce qui
 * casserait un `position:fixed` posé à l'intérieur (même raison que
 * `.drag-portal-anchor`, voir trip-detail.component.scss) — c'est pour ça
 * qu'il n'est instancié qu'une fois, par `TripDetailComponent`, en dehors de
 * `app-trip-day-swiper` (voir `TripCreationTargetService`).
 *
 * Replié = simple icône ronde ; déplié = pilule élargie VERS LA GAUCHE
 * (l'icône reste ancrée à droite) révélant `label()`.
 *
 * Déclencheur du dépli : `:hover` réel sur desktop (`@media (hover:hover)`,
 * voir le SCSS), toggle temporaire ici sur tap (`handleClick`) car le tactile
 * n'a pas de hover. Dans les deux cas un seul clic suffit à déclencher
 * `activate` — le dépli n'est qu'un habillage visuel, jamais une étape
 * supplémentaire avant la création réelle.
 */
@Component({
  selector: 'app-floating-add-button',
  standalone: true,
  templateUrl: './floating-add-button.component.html',
  styleUrl: './floating-add-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--fab-bottom-offset.px]': 'bottomOffset()',
  },
})
export class FloatingAddButtonComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly icon = input('pi pi-plus');
  /** Affiche un petit badge "+" sur le coin de l'icône — utile quand `icon()` porte déjà un sens contextuel (ex. activité vs note) et ne serait plus reconnaissable comme un "ajouter". */
  readonly badge = input(false);
  readonly label = input('Ajouter');
  readonly ariaLabel = input<string | undefined>(undefined);
  /** Espace à réserver sous le bouton (ex. hauteur de la barre des jours, `TripChromeService.tabsNavHeight()`) — le composant n'a aucune raison de connaître ce service lui-même, purement générique. */
  readonly bottomOffset = input(0);

  readonly activate = output<void>();

  protected readonly expanded = signal(false);
  private pulseTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.pulseTimer) clearTimeout(this.pulseTimer);
    });
  }

  protected handleClick(): void {
    this.pulseExpand();
    this.activate.emit();
  }

  private pulseExpand(): void {
    this.expanded.set(true);
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => this.expanded.set(false), TAP_PULSE_DURATION_MS);
  }
}
