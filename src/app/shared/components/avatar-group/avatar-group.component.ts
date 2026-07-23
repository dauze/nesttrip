import { Component } from '@angular/core';

/**
 * Remplacement maison de `p-avatarGroup` (Phase 3 de la sortie de PrimeNG,
 * voir PRIMENG_MIGRATION.md). Le chevauchement lui-même est posé côté
 * `AvatarComponent` via `:host-context(app-avatar-group)` — ce composant-ci
 * ne fait que fournir le conteneur flex que ce sélecteur détecte.
 */
@Component({
  selector: 'app-avatar-group',
  standalone: true,
  templateUrl: './avatar-group.component.html',
  styleUrl: './avatar-group.component.scss',
})
export class AvatarGroupComponent {}
