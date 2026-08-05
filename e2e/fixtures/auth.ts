import { test as base, expect, Page } from '@playwright/test';

/** Lit les identifiants du compte de test dédié (voir .env.e2e.example) — échoue tôt avec un message clair plutôt que de laisser le formulaire échouer silencieusement. */
export function requireTestCredentials(): { email: string; password: string } {
  const email = process.env['E2E_TEST_EMAIL'];
  const password = process.env['E2E_TEST_PASSWORD'];
  if (!email || !password) {
    throw new Error(
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD manquants — copier .env.e2e.example vers .env.e2e et renseigner le compte de test dédié.',
    );
  }
  return { email, password };
}

/** Connexion via le formulaire email/mot de passe (src/app/features/login) — attend la redirection post-login vers /trips (liste) ou /trips/:id (trip unique, voir AccueilTripComponent). */
export async function loginViaUi(page: Page): Promise<void> {
  const { email, password } = requireTestCredentials();

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/trips(\/[^/]+)?$/, { timeout: 15_000 });
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await loginViaUi(page);
    await use(page);
  },
});

export { expect };
