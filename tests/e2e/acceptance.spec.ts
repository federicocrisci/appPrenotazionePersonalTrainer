import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Temporal } from '@js-temporal/polyfill';

// This suite intentionally uses the real local Supabase service, never network mocks.
// Accounts/passwords are generated per run, and removed through the admin API afterwards.
const supabaseUrl = process.env['SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const password = `Test-${randomUUID()}-A1`;
const suffix = randomUUID().slice(0, 8);
const trainerEmail = `trainer-${suffix}@example.test`;
const clientEmail = `client-${suffix}@example.test`;
const secondEmail = `second-${suffix}@example.test`;
const createdUsers: string[] = [];

async function register(page: Page, email: string, role: 'trainer' | 'client', firstName: string): Promise<void> {
  await page.goto('/auth/register');
  await page.locator('ion-input[formcontrolname="firstName"] input').fill(firstName);
  await page.locator('ion-input[formcontrolname="lastName"] input').fill(`E2E-${suffix}`);
  await page.locator('ion-input[formcontrolname="email"] input').fill(email);
  await page.locator('ion-input[formcontrolname="password"] input').fill(password);
  await page.locator('ion-select[formcontrolname="role"]').click();
  await page.locator('ion-popover').getByText(role === 'trainer' ? 'Personal Trainer' : 'Cliente', { exact: true }).click();
  await page.locator('ion-checkbox[formcontrolname="privacy"]').click();
  const responsePromise = page.waitForResponse(response => response.url().includes('/auth/v1/signup') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crea account', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok(), 'Supabase signup succeeds with email confirmation disabled locally').toBeTruthy();
  const body = await response.json() as { user?: { id?: string }; id?: string };
  const id = body.user?.id ?? body.id;
  if (id) createdUsers.push(id);
  await expect(page).toHaveURL(/\/app\/profile$/);
}

async function logout(page: Page): Promise<void> {
  await page.goto('/app/profile');
  await page.getByRole('button', { name: 'Esci dall’account', exact: true }).click();
  await page.locator('ion-alert').getByRole('button', { name: 'Esci', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('ion-input[formcontrolname="email"] input').fill(email);
  await page.locator('ion-input[formcontrolname="password"] input').fill(password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/home$/);
}

async function chooseTrainer(page: Page): Promise<void> {
  await page.goto('/app/book');
  await page.locator('ion-select').click();
  await page.locator('ion-action-sheet').getByText(`Federico E2E-${suffix}`, { exact:true }).click();
}

test.describe('MVP acceptance with real authentication and database', () => {
  test.use({ timezoneId: 'Europe/Rome', locale: 'it-IT' });
  test.skip(!supabaseUrl || !serviceKey, 'Provide the local SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to execute real integration tests.');
  test.afterAll(async () => {
    if (!supabaseUrl || !serviceKey) return;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const id of createdUsers.reverse()) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error(`Failed to clean up E2E account: ${error.code ?? 'unknown'}`);
    }
  });

  test('trainer availability → client booking → trainer agenda → slot absent for another client', async ({ page }) => {
    test.setTimeout(180_000);
    const future = Temporal.Now.zonedDateTimeISO('Europe/Rome').toPlainDate().add({ days: 14 });
    const monday = future.add({ days: (8 - future.dayOfWeek) % 7 }).toString();

    await register(page, trainerEmail, 'trainer', 'Federico');
    await page.goto('/app/availability');
    await expect(page.getByRole('button', { name: 'Aggiungi fascia', exact: true })).toBeEnabled();
    await page.locator('ion-input[name="startTime"] input').fill('09:00');
    await page.locator('ion-input[name="endTime"] input').fill('13:00');
    await page.getByRole('button', { name: 'Aggiungi fascia', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Disponibilità salvata' })).toBeVisible();
    await logout(page);

    await register(page, clientEmail, 'client', 'Mario');
    await chooseTrainer(page);
    await page.getByLabel('Giorno nel fuso del trainer', { exact: false }).fill(monday);
    for (const hour of ['09:00', '10:00', '11:00', '12:00']) {
      await expect(page.getByRole('button', { name: new RegExp(`^Prenota .*${hour}$`) })).toBeVisible();
    }
    await page.getByRole('button', { name: /^Prenota .*10:00$/ }).click();
    await expect(page.locator('ion-modal').getByText('Federico', { exact: false })).toBeVisible();
    await page.locator('ion-modal').getByRole('button', { name: 'Conferma prenotazione', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Prenotazione confermata', exact: true })).toBeVisible();
    await expect(page.locator('.success-panel')).toContainText('10:00');
    await logout(page);

    await login(page, trainerEmail);
    await expect(page.locator('app-booking-card')).toContainText(`Mario E2E-${suffix}`);
    await expect(page.locator('app-booking-card')).toContainText('10:00');
    await page.goto('/app/calendar');
    await page.getByLabel('Giorno nel fuso del trainer', { exact: true }).fill(monday);
    await expect(page.locator('app-booking-card')).toContainText(`Mario E2E-${suffix}`);
    await logout(page);

    await register(page, secondEmail, 'client', 'Luca');
    await chooseTrainer(page);
    await page.getByLabel('Giorno nel fuso del trainer', { exact: false }).fill(monday);
    await expect(page.getByRole('button', { name: /^Prenota .*09:00$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Prenota .*10:00$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Prenota .*11:00$/ })).toBeVisible();
  });
});
