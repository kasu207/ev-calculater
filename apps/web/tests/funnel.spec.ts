import { expect, test } from '@playwright/test';

type Ereignis = { name: string; daten?: Record<string, unknown> };

/**
 * Umami liegt im Test nicht vor. Wir schieben eine Attrappe unter, die jedes
 * Ereignis mitschreibt, und pruefen damit den vollstaendigen Funnel.
 */
async function ereignisseSammeln(seite: import('@playwright/test').Page) {
  await seite.addInitScript(() => {
    const gesammelt: Ereignis[] = [];
    (window as unknown as { __ereignisse: Ereignis[] }).__ereignisse = gesammelt;
    (window as unknown as { umami: unknown }).umami = {
      track: (name: string, daten?: Record<string, unknown>) => gesammelt.push({ name, daten }),
    };
  });
}

async function ereignisse(seite: import('@playwright/test').Page): Promise<Ereignis[]> {
  return seite.evaluate(() => (window as unknown as { __ereignisse: Ereignis[] }).__ereignisse);
}

test('Ergebnis steht ohne Interaktion und ohne JavaScript', async ({ browser }) => {
  const kontext = await browser.newContext({ javaScriptEnabled: false });
  const seite = await kontext.newPage();
  await seite.goto('/');
  await expect(seite.getByRole('link', { name: /bei Carwow ansehen$/ })).toBeVisible();
  await kontext.close();
});

test('Permalink stellt das geteilte Ergebnis wieder her', async ({ page }) => {
  await page.goto('/rechner?km=30000&budget=50000');
  await expect(page.locator('input[name="km"]')).toHaveValue('30000');
  await expect(page.locator('input[name="budget"]')).toHaveValue('50000');
});

test('ungültige Parameter fallen auf die Vorbelegung zurück', async ({ page }) => {
  await page.goto('/rechner?km=abc&budget=-5');
  await expect(page.locator('input[name="km"]')).toHaveValue('15000');
  await expect(page.locator('input[name="budget"]')).toHaveValue('45000');
});

test('zu kleines Budget wird benannt statt verschwiegen', async ({ page }) => {
  await page.goto('/rechner?km=15000&budget=12000');
  await expect(page.getByText(/kein Modell im Datensatz/)).toBeVisible();
  await expect(page.getByRole('link', { name: /bei Carwow ansehen$/ })).toHaveCount(0);
});

test('Funnel von Aufruf bis Weiterleitung feuert in der richtigen Reihenfolge', async ({
  page,
  context,
}) => {
  await ereignisseSammeln(page);
  await page.goto('/');

  await expect.poll(async () => (await ereignisse(page)).map((e) => e.name)).toContain(
    'calc_viewed',
  );
  await expect.poll(async () => (await ereignisse(page)).map((e) => e.name)).toContain(
    'calc_completed',
  );

  await page.locator('input[name="km"]').fill('25000');
  await expect.poll(async () => (await ereignisse(page)).map((e) => e.name)).toContain(
    'calc_input_changed',
  );

  await expect
    .poll(async () => (await ereignisse(page)).filter((e) => e.name === 'calc_completed').length, {
      timeout: 5000,
    })
    .toBeGreaterThan(1);

  const cta = page.getByRole('link', { name: /bei Carwow ansehen$/ });
  await cta.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await ereignisse(page)).map((e) => e.name), { timeout: 5000 })
    .toContain('offer_cta_viewed');

  const [partnerSeite] = await Promise.all([
    context.waitForEvent('page'),
    // force, weil Playwright bei der mobilen Emulation die feste Leiste am
    // unteren Rand falsch verortet. Der Klick selbst ist ein echter Klick.
    cta.click({ noWaitAfter: true, force: true }),
  ]);
  await partnerSeite.close();

  const namen = (await ereignisse(page)).map((e) => e.name);
  expect(namen).toContain('offer_cta_clicked');
  expect(namen).toContain('partner_redirect');
  expect(namen.indexOf('offer_cta_clicked')).toBeLessThan(namen.indexOf('partner_redirect'));
});

test('Partnerlink ist als Werbung ausgezeichnet und offengelegt', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /bei Carwow ansehen$/ });
  await expect(cta).toHaveAttribute('rel', 'sponsored noopener');
  await expect(cta).toHaveAttribute('target', '_blank');
  await expect(page.getByText(/zahlt Carwow uns 10 €/)).toBeVisible();
});

test('interner Zugriff schaltet die Messung ab', async ({ page }) => {
  await ereignisseSammeln(page);
  await page.goto('/?intern=1');
  await page.locator('input[name="km"]').fill('18000');
  await page.waitForTimeout(1200);
  expect(await ereignisse(page)).toHaveLength(0);
});

test('Eingabe ist vollständig mit der Tastatur bedienbar', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('input[name="km"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('input[name="budget"]')).toBeFocused();
});
