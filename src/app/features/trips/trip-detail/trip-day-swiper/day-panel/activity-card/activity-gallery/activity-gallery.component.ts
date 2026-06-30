import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { Place } from '@app/core/models/place.dto';
import { GooglePhotoService } from '@app/core/services/google-photo.service';

const MAX_PHOTOS = 6;

@Component({
  selector: 'app-activity-gallery',
  standalone: true,
  imports: [CommonModule, DividerModule],
  templateUrl: './activity-gallery.component.html',
  styleUrl: './activity-gallery.component.scss',
})
export class ActivityGalleryComponent {
  private readonly photoCache = inject(GooglePhotoService);

  readonly lazyGoogleData = input<Place | null>(null);
  readonly altText = input('');

  readonly photoRefs = computed(() => (this.lazyGoogleData()?.photos ?? []).slice(0, MAX_PHOTOS));

  readonly currentIndex = signal(0);

  prevPhoto(): void { this.currentIndex.update((i) => i - 1); }
  nextPhoto(): void { this.currentIndex.update((i) => i + 1); }

  getPhotoUrl$(ref: string, maxWidth = 800) {
    return this.photoCache.getPhotoUrl$(ref, maxWidth);
  }
}