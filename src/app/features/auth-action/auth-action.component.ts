import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CardComponent } from '@app/shared/components/card/card.component';
import { PasswordComponent } from '@app/shared/components/password/password.component';
import { MessageComponent } from '@app/shared/components/message/message.component';

type ActionState = 'loading' | 'reset-form' | 'reset-done' | 'verify-done' | 'error';

/**
 * Cible des liens envoyés par Firebase Auth (réinitialisation de mot de
 * passe, vérification d'email — voir `AuthService.ACTION_CODE_SETTINGS`,
 * `handleCodeInApp: true`), dans le même style que `LoginComponent` plutôt
 * que la page hébergée par défaut de Firebase (ROADMAP.md "### UI").
 * `mode`/`oobCode` en query params (format imposé par Firebase, voir
 * https://firebase.google.com/docs/auth/custom-email-handler) :
 * - `resetPassword` : vérifie le code puis affiche un formulaire nouveau
 *   mot de passe (mêmes règles que l'inscription).
 * - `verifyEmail` : applique le code immédiatement, affiche une simple
 *   confirmation (rien à saisir).
 * - autre valeur / code invalide ou expiré : message d'erreur générique,
 *   lien de retour vers `/login`.
 */
@Component({
  selector: 'app-auth-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, PasswordComponent, MessageComponent],
  templateUrl: './auth-action.component.html',
  styleUrl: './auth-action.component.scss',
})
export class AuthActionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly state = signal<ActionState>('loading');
  protected readonly errorMsg = signal('');
  protected readonly email = signal<string | null>(null);
  protected readonly submitting = signal(false);

  private readonly oobCode = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/)]],
  });

  protected readonly title = computed(() => {
    switch (this.state()) {
      case 'reset-form': return 'Nouveau mot de passe';
      case 'reset-done': return 'Mot de passe mis à jour';
      case 'verify-done': return 'Email vérifié';
      case 'error': return 'Lien invalide';
      default: return '';
    }
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    this.oobCode.set(oobCode);

    if (!oobCode) {
      this.fail('Ce lien est invalide.');
      return;
    }

    if (mode === 'resetPassword') {
      this.authService.checkPasswordResetCode(oobCode)
        .pipe(catchError(() => { this.fail('Ce lien de réinitialisation est invalide ou a expiré.'); return EMPTY; }))
        .subscribe((email) => {
          this.email.set(email);
          this.state.set('reset-form');
        });
      return;
    }

    if (mode === 'verifyEmail') {
      this.authService.confirmEmailVerification(oobCode)
        .pipe(catchError(() => { this.fail('Ce lien de confirmation est invalide ou a expiré.'); return EMPTY; }))
        .subscribe(() => this.state.set('verify-done'));
      return;
    }

    this.fail('Ce lien est invalide.');
  }

  protected submitNewPassword(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const oobCode = this.oobCode();
    if (!oobCode) return;

    this.submitting.set(true);
    this.authService.submitNewPassword(oobCode, this.form.getRawValue().password)
      .pipe(catchError(() => { this.submitting.set(false); this.fail('Ce lien de réinitialisation est invalide ou a expiré.'); return EMPTY; }))
      .subscribe(() => {
        this.submitting.set(false);
        this.state.set('reset-done');
      });
  }

  protected goToLogin(): void {
    this.router.navigate(['/login']);
  }

  private fail(message: string): void {
    this.errorMsg.set(message);
    this.state.set('error');
  }
}
