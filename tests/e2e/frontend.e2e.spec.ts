import { expect, test } from '@playwright/test'

test.describe('public pages', () => {
  test('shows the current login page', async ({ page }) => {
    await page.goto('/login')

    await expect(page).toHaveTitle(/Login \| .+/)
    await expect(page.getByRole('heading', { name: 'Login to your account' })).toBeVisible()
    await expect(page.getByLabel('Username or Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })

  test('shows the public application form', async ({ page }) => {
    await page.goto('/apply')

    await expect(page).toHaveTitle(/Apply for a Position \| .+/)
    await expect(page.getByRole('heading', { name: 'Join Our Team' })).toBeVisible()
    await expect(page.getByText('Application Form')).toBeVisible()
    await expect(page.getByLabel(/Full Name/)).toBeVisible()
    await expect(page.getByLabel(/Email/)).toBeVisible()
    await expect(page.getByLabel(/Phone Number/)).toBeVisible()
    await expect(page.getByLabel(/Position Applied For/)).toBeVisible()
  })
})
