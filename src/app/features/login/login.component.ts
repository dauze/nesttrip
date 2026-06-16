import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    DividerModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
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
   
  form = this.fb.nonNullable.group({
    firstName: '',
    lastName: '',
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, ]],
  });
  //TODO rajouter Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/)

  
  constructor() {
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
      .subscribe(() => this.loading.set(false));

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