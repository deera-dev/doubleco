import { expect, test } from '@playwright/test'

test('visitors without a session are sent to the login page', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible()
})

test('login form validates the username before calling the server', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Username').fill('A')
  await page.getByRole('button', { name: 'Masuk' }).click()

  await expect(page.getByText('Username 3–20 karakter: huruf kecil, angka, atau _')).toBeVisible()
})

test('activation page links back to login', async ({ page }) => {
  await page.goto('/aktivasi')

  await expect(page.getByRole('heading', { name: 'Aktivasi Akun' })).toBeVisible()
  await page.getByRole('link', { name: 'Kembali ke halaman masuk' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
