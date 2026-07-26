import { Injectable, inject } from '@angular/core';
import { filter, take } from 'rxjs';
import type { SlideData } from 'photoswipe';
import type PhotoSwipeLightbox from 'photoswipe/lightbox';

import { GooglePlaceService } from './google-place.service';
import { GooglePhotoService } from './google-photo.service';
import { PlacePhotoRef } from '@app/core/models/place.dto';

/** Résolution demandée au backend pour l'affichage plein écran (au-delà des tailles miniatures utilisées ailleurs dans l'app). */
const FULLSCREEN_PHOTO_WIDTH = 1600;

interface PhotoSlideData extends SlideData {
  ref: string;
}

/**
 * Visionneur plein écran façon Google Photos pour les photos Google d'une
 * activité : animation de zoom depuis la miniature cliquée, zoom
 * pincé/molette, swipe entre photos, fermeture par croix / clic extérieur /
 * swipe vertical — tout est géré nativement par PhotoSwipe
 * (https://photoswipe.com). Le seul branchement custom est la résolution des
 * URLs (fetch backend en blob, voir GooglePhotoService) : elle se fait à la
 * demande, slide par slide, jamais toutes en une fois à l'ouverture — voir
 * le handler `contentLoad` ci-dessous.
 */
@Injectable()
export class PhotoViewerService {
  private readonly placeService = inject(GooglePlaceService);
  private readonly photoService = inject(GooglePhotoService);

  /**
   * `triggerEl` est l'élément (la miniature) depuis/vers lequel l'animation
   * de zoom démarre et revient, quel que soit l'index affiché à la fermeture
   * (comme dans Google Photos).
   */
  open(params: { placeId: string; altText: string; triggerEl: HTMLElement }): void {
    const { placeId, altText, triggerEl } = params;
    if (!placeId) return;

    this.placeService
      .getPlacePhotos$(placeId)
      .pipe(
        filter((state) => state.status !== 'loading'),
        take(1),
      )
      .subscribe((state) => {
        if (state.status !== 'success' || !state.data.photos.length) return;
        void this.launch(state.data.photos, altText, triggerEl);
      });
  }

  private async launch(photos: PlacePhotoRef[], altText: string, triggerEl: HTMLElement): Promise<void> {
    const { default: Lightbox } = await import('photoswipe/lightbox');

    const dataSource: PhotoSlideData[] = photos.map((photo) => ({
      ref: photo.name,
      width: photo.widthPx,
      height: photo.heightPx,
      alt: altText,
    }));

    const lightbox: PhotoSwipeLightbox = new Lightbox({
      dataSource,
      pswpModule: () => import('photoswipe'),
      showHideAnimationType: 'zoom',
      bgOpacity: 0.95,
      preload: [1, 2],
    });

    lightbox.addFilter('thumbEl', () => triggerEl);
    lightbox.addFilter('placeholderSrc', (placeholderSrc) =>
      triggerEl instanceof HTMLImageElement ? triggerEl.currentSrc || triggerEl.src : placeholderSrc,
    );

    // PhotoSwipe ne connaît au départ que ref+dimensions (pas d'URL) : on
    // n'appelle le backend que quand PhotoSwipe charge réellement ce slide
    // (le courant + les voisins préchargés définis par `preload` ci-dessus),
    // et on force le rechargement du slide une fois l'URL obtenue via
    // `refreshSlideContent` — voir doc PhotoSwipe "Refresh/reload content".
    lightbox.on('contentLoad', (e) => {
      const data = e.content.data as PhotoSlideData;
      if (data.src) return;

      e.preventDefault();
      this.photoService
        .getPhotoUrl$(data.ref, FULLSCREEN_PHOTO_WIDTH)
        .pipe(take(1))
        .subscribe((url) => {
          if (!url || data.src) return;
          data.src = url;
          lightbox.pswp?.refreshSlideContent(e.content.index);
        });
    });

    lightbox.init();
    lightbox.loadAndOpen(0, dataSource);
  }
}
