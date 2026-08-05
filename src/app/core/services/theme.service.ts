import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nt-theme-mode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Choix de thème clair/sombre/système, accessible depuis le menu réglages
 * (roue crantée, voir TripsComponent). "système" (par défaut) ne pose aucun
 * attribut sur `<html>` : le mode clair/sombre est alors entièrement piloté
 * par `@media (prefers-color-scheme: dark)` dans styles/tokens.scss. Un
 * choix explicite pose `data-theme="light"`/`"dark"` sur `<html>`, que ce
 * même fichier sait battre indépendamment de la préférence OS (voir ses
 * mixins nt-dark-tokens/nt-light-tokens).
 *
 * `isDark` reste utile en dehors du CSS pur pour tout ce qui ne peut pas
 * suivre une variable CSS (ex. `colorScheme` de la carte Google Maps, voir
 * TripDayMapComponent) : un seul point de vérité réactif, qui répond aussi
 * bien à un changement système (mode "système") qu'à un choix explicite,
 * sans attendre un rechargement de page.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView!.matchMedia(DARK_QUERY);

  private readonly systemPrefersDark = signal(this.media.matches);
  readonly mode = signal<ThemeMode>(this.readStoredMode());
  readonly isDark = computed(() => {
    const mode = this.mode();
    return mode === 'system' ? this.systemPrefersDark() : mode === 'dark';
  });

  constructor() {
    this.media.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));

    effect(() => {
      const mode = this.mode();
      const root = this.document.documentElement;
      if (mode === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', mode);
      }
      localStorage.setItem(STORAGE_KEY, mode);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private readStoredMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }
}
