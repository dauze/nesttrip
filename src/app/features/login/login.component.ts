import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, DividerModule, InputTextModule, PasswordModule,MessageModule],
  templateUrl: 'login.component.html',
  styleUrls: ['login.component.scss']
})
export class LoginComponent {
  private authService = inject(AuthService);

  email = '';
  password = '';
  isRegister = signal(false);
  loading = signal(false);
  showPassword = false;
  errorMsg = signal('');

  toggleMode() {
    this.isRegister.update(v => !v);
    this.errorMsg.set('');
  }

  loginGoogle() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.authService.loginWithGoogle().pipe(
      catchError(err => {
        this.errorMsg.set(this.friendlyError(err.code));
        this.loading.set(false);
        return EMPTY;
      })
    ).subscribe(() => this.loading.set(false));
  }

  submitEmail() {
    if (!this.email || !this.password) {
      this.errorMsg.set('Veuillez remplir tous les champs.');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');

    const action$ = this.isRegister()
      ? this.authService.registerWithEmail(this.email, this.password)
      : this.authService.loginWithEmail(this.email, this.password);

    action$.pipe(
      catchError(err => {
        this.errorMsg.set(this.friendlyError(err.code));
        this.loading.set(false);
        return EMPTY;
      })
    ).subscribe(() => this.loading.set(false));
  }

  private friendlyError(code: string): string {
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'Email ou mot de passe incorrect.',
      'auth/user-not-found': 'Aucun compte avec cet email.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/email-already-in-use': 'Cet email est déjà utilisé.',
      'auth/weak-password': 'Mot de passe trop faible (6 caractères min).',
      'auth/invalid-email': 'Format d\'email invalide.',
      'auth/popup-closed-by-user': 'Connexion Google annulée.',
      'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    };
    return messages[code] ?? `Erreur : ${code}`;
  }
}