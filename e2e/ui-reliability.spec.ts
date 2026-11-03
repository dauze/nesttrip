import { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';

async function openSummary(page: Page, mobile: boolean): Promise<void> {
  if (mobile) {
    await page.locator('.mobile-trip-nav .bar .tab').first().click();
    await page.locator('button[data-day-id="summary"]').click();
  } else {
    await page.getByRole('tab', { name: 'Général', exact: true }).click();
  }
}

async function openDay(page: Page, mobile: boolean, index: number): Promise<string> {
  if (mobile) {
    await page.locator('.mobile-trip-nav .day-badge').click();
    await expect(page.locator('.mobile-trip-nav .bar')).toHaveAttribute('data-state', 'collapsed');
  }
  const tab = mobile
    ? page.locator('.mobile-trip-nav .day-strip__chip:not(.day-strip__chip--general)').nth(index)
    : page.locator('.app-tab--day').nth(index);
  const dayId = await tab.getAttribute(mobile ? 'data-day-id' : 'data-tab-id');
  expect(dayId).toBeTruthy();
  await tab.click();
  if (mobile) await expect(tab).toHaveClass(/day-strip__chip--active/);
  else await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(mobile ? 'swiper-slide.swiper-slide-active app-day-panel' : 'app-day-panel')).toBeVisible();
  return dayId!;
}

async function createPlacedActivity(page: Page, mobile: boolean, query: string, type: string): Promise<string> {
  await page.getByLabel('Ajouter', { exact: true }).click();
  await page.locator('.app-menu-panel').getByText('Activité', { exact: true }).click();
  if (mobile) {
    await page.locator('.title-edit-dialog__input').fill(query);
    await page.locator('.title-edit-dialog__option').filter({ hasText: query }).first().click({ timeout: 30_000 });
    await page.locator('.app-select-panel').getByRole('button', { name: type, exact: true }).click();
    await page.keyboard.press('Escape');
  } else {
    const draft = page.locator('app-new-activity-draft input');
    await expect(draft).toBeFocused();
    await draft.fill(query);
    await page.locator('.app-autocomplete-panel__option').filter({ hasText: query }).first().click({ timeout: 30_000 });
    await page.locator('app-day-panel #activity-type button').click();
    await page.locator('.app-select-panel').getByRole('button', { name: type, exact: true }).click();
  }
  const card = page.locator(mobile ? 'swiper-slide.swiper-slide-active app-activity-card' : 'app-day-panel app-activity-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('#activity-type .app-select__label')).toHaveText(type);
  await expect(card.locator('app-panel.trip')).toHaveAttribute('style', new RegExp(type === 'Visite' ? '--nt-activity-visite' : '--nt-activity-repas'));
  await expect(page.locator('.save-status-bar:not(.save-status-bar--error)')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.save-status-bar')).toHaveCount(0, { timeout: 15_000 });
  return mobile
    ? (await card.locator('.activity-header__title-text').innerText()).trim()
    : await card.getByRole('textbox', { name: "Nom de l'activité", exact: true }).inputValue();
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'mobile' : 'desktop', () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });

    test('nested editors, settings and scroll remain usable', async ({ authenticatedPage: page }, testInfo) => {
      test.setTimeout(180_000);
      page.setDefaultTimeout(15_000);
      const title = `E2E UI Reliability ${Date.now()}`;
      let tripUrl: string | undefined;
      try {
        const places = [
          { placeId: 'e2e-eiffel', name: 'Tour Eiffel', address: 'Champ de Mars, Paris', latitude: 48.85837, longitude: 2.294481 },
          { placeId: 'e2e-flore', name: 'Café de Flore', address: '172 Boulevard Saint-Germain, Paris', latitude: 48.854159, longitude: 2.33257 },
        ];
        await page.route('**/etablissements?*', async route => {
          const query = new URL(route.request().url()).searchParams.get('q') ?? '';
          await route.fulfill({ json: places.filter(place => place.name.toLowerCase().includes(query.toLowerCase())) });
        });
        await page.route('**/etablissements/e2e-*/photos', route => route.fulfill({ json: { photos: [] } }));
        await page.addInitScript(() => {
          localStorage.setItem('nt-geolocation-enabled', 'false');
          const requests: string[] = [];
          Object.defineProperty(window, '__geolocationRequests', { value: requests });
          Object.defineProperty(navigator, 'geolocation', {
            value: {
              getCurrentPosition: (success: PositionCallback) => {
                requests.push('position');
                success({ coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 } } as GeolocationPosition);
              },
            },
          });
        });
        if (mobile) await page.setViewportSize({ width: 1000, height: 1000 });
        await page.goto('/trips/new');
        await page.locator('#title').fill(title);
        await page.locator('app-autocomplete input').fill('Paris');
        await page.locator('#dates').fill('03/12/2026 - 05/12/2026');
        await page.locator('#dates').press('Enter');
        await page.getByRole('button', { name: 'Créer le voyage' }).click();
        await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}/);
        tripUrl = page.url();
        if (mobile) await page.setViewportSize({ width: 390, height: 844 });
        await openSummary(page, mobile);
        await expect(page.locator('.trip-header__title')).toHaveText(title);
        await page.getByRole('button', { name: 'Voir toutes les dépenses' }).click();
        await page.getByRole('button', { name: 'Ajouter une dépense manuelle' }).click();
        const amount = page.locator('.price-edit-dialog__amount');
        await expect(amount).toBeFocused();
        await amount.fill('12');
        await page.locator('app-price-edit-dialog').getByRole('button', { name: 'OK', exact: true }).click();
        const label = page.locator('.simple-text-entry-dialog__input');
        await expect(label).toBeFocused();
        await page.keyboard.type('Test expense');
        await expect(label).toHaveValue('Test expense');
        await expect(page.locator('app-title-edit-dialog')).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath('expense-focus.png') });
        await page.getByRole('button', { name: 'Annuler', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Ajouter une dépense manuelle' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Voir toutes les dépenses' })).toBeFocused();
        await expect(page.locator('.cdk-global-scrollblock')).toHaveCount(0);
        await page.getByRole('button', { name: 'Paramètres du voyage', exact: true }).click();
        await page.getByRole('button', { name: /^Titre/ }).click();
        await expect(label).toBeFocused();
        await page.getByRole('button', { name: 'Annuler', exact: true }).click();
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Réglages globaux', exact: true }).click();
        const geolocation = page.getByRole('checkbox', { name: 'Autoriser l’affichage de ma position sur les cartes' });
        const positionRequests = () => page.evaluate(() => (window as Window & { __geolocationRequests: string[] }).__geolocationRequests.length);
        await expect(geolocation).not.toBeChecked();
        expect(await positionRequests()).toBe(0);
        await geolocation.click();
        await expect(geolocation).toBeChecked();
        await expect.poll(positionRequests).toBe(1);
        await expect.poll(() => page.evaluate(() => localStorage.getItem('nt-geolocation-enabled'))).toBe('true');
        await page.screenshot({ path: testInfo.outputPath('global-settings.png') });
        await geolocation.click();
        await expect(geolocation).not.toBeChecked();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('nt-geolocation-enabled'))).toBe('false');
        expect(await positionRequests()).toBe(1);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Recentrer sur ma position' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Voyageurs', exact: true }).click();
        const radius = await page.locator('.app-travellers-dialog-panel').evaluate(element => ({
          actual: getComputedStyle(element).borderTopLeftRadius,
          expected: `${parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nt-overlay-modal-border-radius')) * parseFloat(getComputedStyle(document.documentElement).fontSize)}px`,
        }));
        expect(radius.actual).toBe(radius.expected);
        await page.screenshot({ path: testInfo.outputPath('travellers.png') });
        await page.keyboard.press('Escape');
        await page.screenshot({ path: testInfo.outputPath('summary.png'), fullPage: true });
        await page.getByLabel('Ajouter', { exact: true }).click();
        await page.locator('.app-menu-panel').getByRole('button', { name: 'Train', exact: true }).click();
        if (mobile) {
          await page.locator('.app-select-panel').getByRole('button', { name: 'Sans réservation', exact: true }).click();
          const placeDialog = page.locator('app-title-edit-dialog');
          const departure = placeDialog.getByPlaceholder('Rechercher une gare...');
          await expect(placeDialog).toContainText('Gare de départ');
          await page.screenshot({ path: testInfo.outputPath('train-place-dialog.png') });
          await expect(departure).toBeFocused();
          await page.keyboard.type('Paris Gare de Lyon');
          await expect(departure).toHaveValue('Paris Gare de Lyon');
          await expect(page.locator('app-simple-text-entry-dialog')).toHaveCount(0);
          await placeDialog.getByRole('button', { name: 'Annuler', exact: true }).click();
        } else {
          const departure = page.locator('app-train-fields input').first();
          await departure.click();
          await expect(departure).toBeFocused();
          await page.keyboard.type('Paris Gare de Lyon');
          await expect(departure).toHaveValue('Paris Gare de Lyon');
          await page.screenshot({ path: testInfo.outputPath('train-place-inline.png') });
        }
        await page.keyboard.press('Escape');
        await expect(page.locator('.cdk-global-scrollblock')).toHaveCount(0);
        await openSummary(page, mobile);
        await page.getByLabel('Ajouter', { exact: true }).click();
        await page.locator('.app-menu-panel').getByText('Vol', { exact: true }).click();
        if (mobile) {
          const flightNumber = page.locator('.simple-text-entry-dialog__input');
          await expect(flightNumber).toBeFocused();
          await page.keyboard.type('AF1234');
          await expect(flightNumber).toHaveValue('AF1234');
          await page.getByRole('button', { name: 'Annuler', exact: true }).click();
        }
        const airline = page.locator('#logistic-airline');
        await airline.click();
        await expect(airline).toBeFocused();
        await page.keyboard.type('Air France E2E');
        await expect(airline).toHaveValue('Air France E2E');
        await expect(page.locator('app-title-edit-dialog')).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath('flight-company-focus.png') });
      } finally {
        test.setTimeout(testInfo.timeout + 30_000);
        if (tripUrl) {
          await page.goto(tripUrl);
          await page.reload();
          await openSummary(page, mobile);
          await expect(page.locator('.trip-header__title')).toHaveText(title);
          await page.getByRole('button', { name: 'Paramètres du voyage', exact: true }).click();
          await page.getByRole('button', { name: /Supprimer le voyage/ }).click({ timeout: 5000 });
          await page.getByRole('button', { name: 'Oui', exact: true }).click({ timeout: 5000 });
          await expect(page).not.toHaveURL(tripUrl);
        }
      }
    });

    test('map spotlight preserves J1/J3 types, placement navigation and scroll', async ({ authenticatedPage: page }, testInfo) => {
      test.setTimeout(180_000);
      page.setDefaultTimeout(15_000);
      const title = `E2E Map Reliability ${Date.now()}`;
      let tripUrl: string | undefined;
      const places = [
        { placeId: 'e2e-eiffel', name: 'Tour Eiffel', address: 'Champ de Mars, Paris', latitude: 48.85837, longitude: 2.294481 },
        { placeId: 'e2e-flore', name: 'Café de Flore', address: '172 Boulevard Saint-Germain, Paris', latitude: 48.854159, longitude: 2.33257 },
      ];
      await page.route('**/etablissements?*', async route => {
        const query = new URL(route.request().url()).searchParams.get('q') ?? '';
        await route.fulfill({ json: places.filter(place => place.name.toLowerCase().includes(query.toLowerCase())) });
      });
      await page.route('**/etablissements/e2e-*/photos', route => route.fulfill({ json: { photos: [] } }));
      try {
        if (mobile) await page.setViewportSize({ width: 1000, height: 1000 });
        await page.goto('/trips/new');
        await page.locator('#title').fill(title);
        await page.locator('app-autocomplete input').fill('Paris');
        await page.locator('#dates').fill('03/12/2026 - 05/12/2026');
        await page.locator('#dates').press('Enter');
        await page.getByRole('button', { name: 'Créer le voyage' }).click();
        await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}/);
        tripUrl = page.url();
        if (mobile) await page.setViewportSize({ width: 390, height: 844 });
        const firstDay = await openDay(page, mobile, 0);
        const firstTitle = await createPlacedActivity(page, mobile, 'Tour Eiffel', 'Visite');
        const thirdDay = await openDay(page, mobile, 2);
        const thirdTitle = await createPlacedActivity(page, mobile, 'Café de Flore', 'Repas');
        await openSummary(page, mobile);
        const map = page.locator('.trip-summary-map-container google-map');
        await expect(map).toBeVisible();
        await expect.poll(() => map.locator('img').evaluateAll(images => images.some(image =>
          /\/vt(?:\?|\/)|StaticMapService/.test(image.currentSrc) && image.complete && image.naturalWidth > 0,
        )), { timeout: 30_000 }).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('map-overview.png') });
        await expect(map.locator('.gm-err-container')).toHaveCount(0);
        await expect(map.locator('[data-glow*="--nt-activity-visite"]')).toHaveText('J1');
        for (const placement of [
          { day: 1, id: firstDay, title: firstTitle },
          { day: 3, id: thirdDay, title: thirdTitle },
        ]) {
          const spotlight = page.getByRole('button', { name: `Ouvrir ${placement.title}, jour ${placement.day}`, exact: true });
          await expect(spotlight).toBeVisible({ timeout: 30_000 });
          await expect(spotlight.locator('.trip-summary-map-spotlight__day')).toContainText(`J${placement.day} ·`);
          const typeColor = placement.day === 1 ? '--nt-activity-visite' : '--nt-activity-repas';
          await expect(map.locator(`[data-glow*="${typeColor}"]`)).toHaveText(`J${placement.day}`, { timeout: 15_000 });
          const slotBounds = await page.locator('.trip-summary-map-spotlight-slot').boundingBox();
          expect(slotBounds!.height).toBeGreaterThan(0);
          await map.click({ position: { x: 20, y: 80 } });
          await expect(spotlight).toHaveCount(0);
          const emptySlotBounds = await page.locator('.trip-summary-map-spotlight-slot').boundingBox();
          expect(emptySlotBounds!.height).toBe(slotBounds!.height);
          await expect(spotlight).toBeVisible({ timeout: 30_000 });
          const streetView = map.getByRole('button', { name: /Street View/i }).first();
          await expect(streetView).toBeVisible();
          const spotlightBounds = await spotlight.boundingBox();
          const streetViewBounds = await streetView.boundingBox();
          expect(spotlightBounds).not.toBeNull();
          expect(streetViewBounds).not.toBeNull();
          expect(spotlightBounds!.y).toBeGreaterThanOrEqual(streetViewBounds!.y + streetViewBounds!.height);
          await page.screenshot({ path: testInfo.outputPath(`map-spotlight-j${placement.day}.png`) });
          await spotlight.click();
          const activeDay = mobile ? page.locator('.day-strip__chip--active') : page.getByRole('tab', { selected: true });
          await expect(activeDay).toHaveAttribute(mobile ? 'data-day-id' : 'data-tab-id', placement.id);
          const card = page.locator(mobile ? 'swiper-slide.swiper-slide-active app-activity-card' : 'app-day-panel app-activity-card');
          await expect(card).toHaveCount(1);
          if (mobile) await expect(card.locator('.activity-header__title-text')).toHaveText(placement.title);
          else await expect(card.getByRole('textbox', { name: "Nom de l'activité", exact: true })).toHaveValue(placement.title);
          await page.setViewportSize({ width: mobile ? 390 : 1440, height: 640 });
          const scrollport = page.locator(mobile ? 'swiper-slide.swiper-slide-active' : '.desktop-day-sidebar__scroll');
          await expect.poll(() => scrollport.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
          await scrollport.evaluate(element => { element.scrollTop = 0; });
          const bounds = await scrollport.boundingBox();
          expect(bounds).not.toBeNull();
          const visibleBottom = Math.min(bounds!.y + bounds!.height, page.viewportSize()!.height - (mobile ? 150 : 30));
          await page.mouse.move(bounds!.x + bounds!.width - 20, visibleBottom - 20);
          await page.mouse.wheel(0, 5000);
          await expect.poll(() => scrollport.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
          await expect.configure({ soft: true }).poll(async () => {
            const currentBounds = await scrollport.boundingBox();
            if (currentBounds) {
              const bottom = Math.min(currentBounds.y + currentBounds.height, page.viewportSize()!.height - (mobile ? 150 : 30));
              await page.mouse.move(currentBounds.x + currentBounds.width - 20, bottom - 20);
            }
            await page.mouse.wheel(0, 5000);
            return scrollport.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop);
          }, { timeout: 10_000 }).toBeLessThan(5);
          await page.screenshot({ path: testInfo.outputPath(`placement-scroll-j${placement.day}.png`) });
          await expect(page.locator('.cdk-global-scrollblock')).toHaveCount(0);
          await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
          await openSummary(page, mobile);
        }
      } finally {
        test.setTimeout(testInfo.timeout + 30_000);
        if (tripUrl) {
          await page.goto(tripUrl);
          await page.reload();
          await openSummary(page, mobile);
          await expect(page.locator('.trip-header__title')).toHaveText(title);
          await page.getByRole('button', { name: 'Paramètres du voyage', exact: true }).click();
          await page.getByRole('button', { name: /Supprimer le voyage/ }).click({ timeout: 5000 });
          await page.getByRole('button', { name: 'Oui', exact: true }).click({ timeout: 5000 });
          await expect(page).not.toHaveURL(tripUrl);
        }
      }
    });
  });
}