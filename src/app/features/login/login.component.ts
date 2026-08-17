import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, EMPTY, of } from 'rxjs';
import { AuthService } from '@core/services/business/auth.service';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { CardComponent } from '@app/shared/components/layout/card/card.component';
import { DividerComponent } from '@app/shared/components/layout/divider/divider.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { PasswordComponent } from '@app/shared/components/form-fields/password/password.component';
import { MessageComponent } from '@app/shared/components/feedback/message/message.component';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    DividerComponent,
    InputTextDirective,
    PasswordComponent,
    MessageComponent,
  ],
  templateUrl: 'login.component.html',
  styleUrls: ['login.component.scss'],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  isRegister = signal(false);
  loading = signal(false);
  errorMsg = signal('');
  infoMsg = signal('');
  resetLoading = signal(false);

  /**
   * Email de la session Firebase active mais non vérifiée — `null` sinon
   * (aucune session, ou session déjà vérifiée). Remplace tout le formulaire
   * par le rappel "vérifiez votre email" (voir template) tant que ce champ
   * est renseigné. Alimenté (a) au montage, pour une session non vérifiée
   * restée active d'une visite précédente (Firebase persiste la session —
   * `authGuard` bloque `/trips` mais ne déconnecte pas), et (b) après chaque
   * tentative de connexion/inscription réussie (voir `submitEmail`) — ni
   * `loginWithEmail` ni `registerWithEmail` ne naviguent vers `/app` pour un
   * compte non vérifié (voir `AuthService`), donc `submitEmail` doit vérifier
   * lui-même l'état du compte après coup pour afficher ce rappel.
   */
  unverifiedEmail = signal<string | null>(null);
  resendLoading = signal(false);
  resendSent = signal(false);

  form = this.fb.nonNullable.group({
    firstName: '',
    lastName: '',
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/) ]],
  });
  
  constructor() {
    const user = this.authService.getCurrentUser();
    if (user && !user.emailVerified) this.unverifiedEmail.set(user.email);

    effect(() => {
      const register = this.isRegister();
      const firstName = this.form.controls.firstName;
      const lastName = this.form.controls.lastName;

      if (register) {
        firstName.setValidators([
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[a-zA-ZÀ-ÿ '-]+$/),
        ]);
        lastName.setValidators([
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[a-zA-ZÀ-ÿ '-]+$/),
        ]);
      } else {

        firstName.clearValidators();
        lastName.clearValidators();
      }

      firstName.updateValueAndValidity({ emitEvent: false });
      lastName.updateValueAndValidity({ emitEvent: false });
    });
  }


  toggleMode() {
    this.isRegister.update((v) => !v);
    this.form.reset();
    this.errorMsg.set('');
    this.infoMsg.set('');
  }

  /**
   * Réutilise le champ email déjà saisi (pas de nouvel écran, voir décision
   * ROADMAP.md 2026-08-09). Message générique dans tous les cas (succès ou
   * échec Firebase) : ne pas révéler si l'email correspond à un compte
   * existant (énumération de comptes, OWASP).
   */
  forgotPassword() {
    this.form.controls.email.markAsTouched();
    if (this.form.controls.email.invalid) {
      this.errorMsg.set('Renseignez votre email pour réinitialiser le mot de passe.');
      return;
    }

    const email = this.form.controls.email.value;
    this.resetLoading.set(true);
    this.errorMsg.set('');
    this.infoMsg.set('');

    this.authService.resetPassword(email).pipe(catchError(() => of(undefined))).subscribe(() => {
      this.resetLoading.set(false);
      this.infoMsg.set(`Si un compte existe pour ${email}, un e-mail de réinitialisation vient d'être envoyé.`);
    });
  }

  loginGoogle() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.authService
      .loginWithGoogle()
      .pipe(
        catchError((err) => {
          this.errorMsg.set(this.friendlyError(err.code));
          this.loading.set(false);
          return EMPTY;
        }),
      )
      .subscribe(() => this.loading.set(false));
  }

  submitEmail() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Veuillez corriger les informations.');
      return;
    }

    const { email, password, firstName, lastName } = this.form.getRawValue();

    this.loading.set(true);
    this.errorMsg.set('');
    this.infoMsg.set('');

    const action$ = this.isRegister()
      ? this.authService.registerWithEmail(email, password, firstName, lastName)
      : this.authService.loginWithEmail(email, password);
    action$
      .pipe(
        catchError((err) => {
          this.errorMsg.set(this.friendlyError(err?.code));
          this.loading.set(false);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.loading.set(false);
        const user = this.authService.getCurrentUser();
        if (user && !user.emailVerified) this.unverifiedEmail.set(user.email);
      });
  }

  resendVerification(): void {
    this.resendLoading.set(true);
    this.authService.resendVerificationEmail().subscribe(() => {
      this.resendLoading.set(false);
      this.resendSent.set(true);
    });
  }

  /** "Utiliser un autre compte" — déconnecte la session non vérifiée et repasse au formulaire. */
  useAnotherAccount(): void {
    this.authService.logout().subscribe(() => {
      this.unverifiedEmail.set(null);
      this.resendSent.set(false);
      this.form.reset();
    });
  }

  private friendlyError(code?: string): string {
    if (!code) return 'Une erreur est survenue.';

    if (this.isRegister()) {
      if (code === 'auth/email-already-in-use') {
        return 'Cet email est déjà utilisé.';
      }
      if (code === 'auth/weak-password') {
        return 'Mot de passe trop faible.';
      }
      return 'Impossible de créer le compte.';
    }
    // login = toujours flou
    return 'Email ou mot de passe incorrect.';
  }
}
