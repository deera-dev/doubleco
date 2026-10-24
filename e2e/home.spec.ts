import { expect, test } from '@playwright/test'

test('home page loads and the counter is interactive', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('doubleco')).toBeVisible()

  const increment = page.getByRole('button', { name: 'Increment' })
  await increment.click()
  await increment.click()

  await expect(page.getByText('2', { exact: true })).toBeVisible()
})
