import { expect, test } from '@playwright/test'

const CODE = '7501234567890'

// Replaces the camera with a canvas stream and, optionally, the native BarcodeDetector with a fake.
// detector: 'none' removes the native API so the app falls back to ZXing WASM.
// failFirst: number of detect() calls that throw before it starts returning CODE (null = always throws).
// cameraDelayMs: simulates the time the user takes to grant camera permission.
// format: value reported as the barcode format.
// jitter: pixels the code shifts sideways on every other frame (simulates a moving phone).
async function mockDevice(page, { detector = 'fake', failFirst = 0, cameraDelayMs = 0, format = 'ean_13', jitter = 0 } = {}) {
  await page.addInitScript(
    ({ detector, failFirst, cameraDelayMs, format, jitter, CODE }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const g = canvas.getContext('2d')
      setInterval(() => {
        g.fillStyle = '#556'
        g.fillRect(0, 0, canvas.width, canvas.height)
      }, 33)
      navigator.mediaDevices.getUserMedia = () =>
        new Promise((resolve) =>
          setTimeout(() => {
            window.__cameraReadyAt = performance.now()
            resolve((window.__stream = canvas.captureStream(30)))
          }, cameraDelayMs),
        )

      if (detector === 'none') {
        delete window.BarcodeDetector
        return
      }
      // The count lives in sessionStorage so it survives page reloads within a test
      window.BarcodeDetector = class {
        constructor(options) {
          window.__formats = options?.formats
        }
        async detect() {
          await new Promise((r) => setTimeout(r, 10))
          const calls = Number(sessionStorage.getItem('detectCalls') ?? 0)
          sessionStorage.setItem('detectCalls', calls + 1)
          if (failFirst === null || calls < failFirst) throw new Error('decoder crashed')
          return [{ rawValue: CODE, format, boundingBox: { x: 100 + (calls % 2) * jitter, y: 40, width: 200, height: 60 } }]
        }
      }
    },
    { detector, failFirst, cameraDelayMs, format, jitter, CODE },
  )
}

// Opens the demo page and the scanner modal
async function openScanner(page, url = '/') {
  await page.goto(url)
  await page.getByRole('button', { name: 'Scan barcode' }).click()
}

const streamEnded = (page) => page.evaluate(() => window.__stream.getTracks().every((t) => t.readyState === 'ended'))

const cameraIsLive = (page) =>
  page.evaluate(() => document.querySelector('video').srcObject?.getTracks().some((t) => t.readyState === 'live'))

test('confirms a code only after holding it for the full confirmation time', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)

  await expect(page.getByText('Hold steady…')).toBeVisible()
  const ring = page.locator('.ring-fill')
  await expect(ring).toBeVisible()
  expect(await ring.evaluate((el) => el.getAnimations().map((a) => a.animationName))).toEqual(['ring-fill'])

  // Still confirming halfway through
  await page.waitForTimeout(1500)
  await expect(page.locator('.code')).toHaveCount(0)

  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 5000 })
  await expect(page.getByText('ean_13')).toBeVisible()
})

test('can scan again after a code was returned', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)
  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 10000 })
  await page.getByRole('button', { name: 'Scan barcode' }).click()

  await expect(page.getByText('Hold steady…')).toBeVisible()
})

test('returns the code to the host, closes the modal and stops the camera', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)

  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 10000 })
  await expect(page.locator('dialog.scanner')).toBeHidden()
  expect(await streamEnded(page)).toBe(true)
})

for (const [how, close] of [
  ['the close button', (page) => page.getByRole('button', { name: 'Close' }).click()],
  ['Escape', (page) => page.keyboard.press('Escape')],
]) {
  test(`${how} closes the modal and stops the camera without a code`, async ({ page }) => {
    await mockDevice(page)
    await openScanner(page)
    await expect(page.getByText('Hold steady…')).toBeVisible()

    await close(page)
    await expect(page.locator('dialog.scanner')).toBeHidden()
    expect(await streamEnded(page)).toBe(true)
    await expect(page.locator('.code')).toHaveCount(0)
  })
}

test('ignores transient detector failures', async ({ page }) => {
  await mockDevice(page, { failFirst: 10 })
  await openScanner(page)

  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 10000 })
  await expect(page.locator('.error')).toHaveCount(0)
})

test('shows an error and stops the camera when the detector keeps failing', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await openScanner(page)

  await expect(page.locator('.error')).toHaveText('Scanner stopped working: decoder crashed', { timeout: 10000 })
  expect(await cameraIsLive(page)).toBe(false)
})

test('try again recovers after the detector stopped working', async ({ page }) => {
  // Fails exactly long enough to trigger the error, then works
  await mockDevice(page, { failFirst: 60 })
  await openScanner(page)
  await page.getByRole('button', { name: 'Try again' }).click({ timeout: 10000 })

  await expect(page.locator('.error')).toHaveCount(0)
  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 10000 })
})

test('native engine never downloads ZXing', async ({ page }) => {
  const zxingRequests = []
  page.on('request', (r) => {
    if (/ponyfill|\.wasm/.test(r.url())) zxingRequests.push(r.url())
  })
  await mockDevice(page)
  await openScanner(page)

  await expect(page.getByText('Engine: native')).toBeVisible()
  await expect(page.getByText('Hold steady…')).toBeVisible()
  expect(zxingRequests).toEqual([])
})

test('ZXing engine starts downloading the WASM before the camera is ready', async ({ page }) => {
  await mockDevice(page, { detector: 'none', cameraDelayMs: 1500 })
  await openScanner(page)

  await expect(page.getByText('Point the camera at a barcode')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Engine: zxing-wasm')).toBeVisible()
  const { wasmStart, cameraReady } = await page.evaluate(() => ({
    wasmStart: performance.getEntriesByType('resource').find((e) => e.name.endsWith('.wasm'))?.startTime,
    cameraReady: window.__cameraReadyAt,
  }))
  expect(wasmStart).toBeLessThan(cameraReady)
})

test('shows an error instead of a blank screen when rendering crashes', async ({ page }) => {
  // An object is not a valid React child, so rendering the result throws
  await mockDevice(page, { format: { broken: true } })
  await openScanner(page)

  await expect(page.locator('.error')).toContainText('Something went wrong', { timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('in landscape the scan area fits inside the camera view', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await mockDevice(page)
  await openScanner(page)
  await expect(page.locator('.guide')).toBeVisible()

  const { view, guide } = await page.evaluate(() => ({
    view: document.querySelector('.viewport').getBoundingClientRect().toJSON(),
    guide: document.querySelector('.guide').getBoundingClientRect().toJSON(),
  }))
  expect(guide.top).toBeGreaterThanOrEqual(view.top)
  expect(guide.bottom).toBeLessThanOrEqual(view.bottom)
  // The camera keeps most of the screen instead of sharing it with a tall panel
  expect(view.width * view.height).toBeGreaterThan(844 * 390 * 0.6)
})

test('in portrait the scan area takes 80% of the camera width', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)
  await expect(page.locator('.guide')).toBeVisible()

  const ratio = await page.evaluate(
    () => document.querySelector('.guide').offsetWidth / document.querySelector('.viewport').clientWidth,
  )
  expect(ratio).toBeCloseTo(0.8, 1)
})

test('only asks the detector for linear barcodes, not QR or other 2D codes', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)
  await expect(page.getByText('Hold steady…')).toBeVisible()

  const formats = await page.evaluate(() => window.__formats)
  expect(formats).toEqual(expect.arrayContaining(['ean_13', 'code_128']))
  for (const f of ['qr_code', 'data_matrix', 'aztec', 'pdf417']) expect(formats).not.toContain(f)
})

test('cancels the confirmation while the code keeps moving', async ({ page }) => {
  // 100px on a 200px wide code: well over the tolerance
  await mockDevice(page, { jitter: 100 })
  await openScanner(page)
  await expect(page.getByText('Engine: native')).toBeVisible()

  // Longer than CONFIRM_MS: a still code would be confirmed by now
  await page.waitForTimeout(4500)
  await expect(page.locator('.code')).toHaveCount(0)
})

test('small hand tremor does not cancel the confirmation', async ({ page }) => {
  // 10px on a 200px wide code: inside the tolerance
  await mockDevice(page, { jitter: 10 })
  await openScanner(page)

  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 6000 })
})

test('debug mode outlines the analyzed area over the scan guide', async ({ page }) => {
  await mockDevice(page, { detector: 'none' }) // real ZXing finds nothing in a blank frame, so the guide stays visible
  await openScanner(page, '/?debug')
  await expect(page.locator('.debug-info')).toContainText('video 1280x720')

  const [crop, guide] = await Promise.all(
    ['.debug-crop', '.guide'].map((s) => page.locator(s).evaluate((el) => el.getBoundingClientRect().toJSON())),
  )
  // The red area must match the white guide (border width aside)
  for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(crop[k] - guide[k])).toBeLessThan(4)
})

test('debug overlay is hidden without ?debug', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)
  await expect(page.getByText('Hold steady…')).toBeVisible()
  await expect(page.locator('.debug')).toHaveCount(0)
})
