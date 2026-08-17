import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { TripStore } from '@app/features/trips/trip-store.service';

/** Combien de temps la barre verte "Sauvegardé" reste visible avant de s'effacer. */
const SAVED_PULSE_DURATION_MS = 1800;

/**
 * Indicateur discret de sauvegarde, monté une fois par TripsComponent (comme
 * FloatingAddButtonComponent) : une fine barre tout en haut de l'écran, verte
 * un court instant après un flush réussi d'un writer débouncé (voir
 * TripStore.saveStatus), rouge et persistante tant qu'un writer est en échec
 * (retry automatique en cours côté DebounceWriter, voir sa doc).
 *
 * Ne s'affiche PAS pendant le `syncing` lui-même (300ms de debounce + écriture
 * réseau, trop bref/fréquent pour valoir un affichage) — seulement au
 * résultat (succès ou échec), voir ROADMAP.md.
 */
@Component({
  selector: 'app-save-status-bar',
  standalone: true,
  templateUrl: './save-status-bar.component.html',
  styleUrl: './save-status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveStatusBarComponent {
  private readonly tripStore = inject(TripStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visible = signal(false);
  protected readonly kind = signal<'saved' | 'error'>('saved');

  private wasActive = false;
  private hideTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const status = this.tripStore.saveStatus();

      if (status === 'error') {
        this.wasActive = true;
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.kind.set('error');
        this.visible.set(true);
        return;
      }

      if (status === 'saving') {
        this.wasActive = true;
        return;
      }

      // 'idle' : n'affiche le pulse vert que si on venait bien de
      // sauvegarder/réessayer (pas au tout premier rendu de l'app).
      if (!this.wasActive) return;
      this.wasActive = false;

      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.kind.set('saved');
      this.visible.set(true);
      this.hideTimer = setTimeout(() => this.visible.set(false), SAVED_PULSE_DURATION_MS);
    });

    this.destroyRef.onDestroy(() => {
      if (this.hideTimer) clearTimeout(this.hideTimer);
    });
  }
}
