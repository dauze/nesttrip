import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Indicateur visuel "tirer pour actualiser" façon Google (Gmail/Chrome
 * mobile) — émerge de sous la toolbar app (`.app-toolbar`) : une flèche qui
 * tourne proportionnellement à la distance tirée (`progress`, 0 = au
 * repos/caché, 1 = seuil de déclenchement atteint), puis un spinner continu
 * une fois `refreshing()` vrai (voir `PullToRefreshDirective`, seul
 * responsable du geste — ce composant est purement présentationnel).
 */
@Component({
  selector: 'app-pull-to-refresh-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-to-refresh-indicator.component.html',
  styleUrl: './pull-to-refresh-indicator.component.scss',
})
export class PullToRefreshIndicatorComponent {
  /** 0 (repos) à ~1.4 (rubber-band au-delà du seuil de 1) — piloté en direct par `PullToRefreshDirective` pendant le tirage. */
  readonly progress = input(0);
  /** Vrai entre le relâchement (seuil atteint) et la fin de l'actualisation — le spinner tourne en continu, `progress` n'est plus lu pour la rotation. */
  readonly refreshing = input(false);
  /** Décalage vertical (px) sous lequel l'indicateur émerge — hauteur réelle de la toolbar app, voir TripChromeService.toolbarHeight. */
  readonly topOffset = input(0);

  /** Rotation de la flèche (degrés) : suit le tirage 1:1 jusqu'au seuil (0 -> 180°), fige à 180° au-delà (le dépassement du seuil est déjà communiqué par le style "prêt à lâcher"). */
  protected readonly rotationDeg = computed(() => Math.min(1, this.progress()) * 180);

  /**
   * Translation verticale (px) : part à MOITIÉ CACHÉ derrière la toolbar
   * (`topOffset() - 20`, `z-index` volontairement sous celui de la toolbar —
   * voir `.scss` — pour que celle-ci la recouvre visuellement à ce stade) et
   * glisse jusqu'à sa position de repos, pleinement visible sous la toolbar,
   * une fois le seuil atteint — matérialise "la flèche qui vient de sous la
   * bar de header" (retour utilisateur) plutôt qu'une simple apparition sur
   * place. Pas de dépassement infini même si le doigt continue de tirer
   * au-delà (rubber-band déjà géré en amont par la directive sur `progress`).
   */
  protected readonly translateY = computed(() => {
    const p = Math.min(1.15, this.progress());
    return this.topOffset() - 20 + p * 44;
  });

  protected readonly visible = computed(() => this.refreshing() || this.progress() > 0);
  protected readonly opacity = computed(() => (this.refreshing() ? 1 : Math.min(1, this.progress() * 1.6)));
  protected readonly ready = computed(() => this.progress() >= 1);
}
