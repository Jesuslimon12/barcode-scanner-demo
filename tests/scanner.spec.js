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
  const ring = page.locator('.bsm-ring-fill')
  await expect(ring).toBeVisible()
  expect(await ring.evaluate((el) => el.getAnimations().map((a) => a.animationName))).toEqual(['bsm-ring-fill'])

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
  await expect(page.locator('dialog.bsm-scanner')).toBeHidden()
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
    await expect(page.locator('dialog.bsm-scanner')).toBeHidden()
    expect(await streamEnded(page)).toBe(true)
    await expect(page.locator('.code')).toHaveCount(0)
  })
}

test('ignores transient detector failures', async ({ page }) => {
  await mockDevice(page, { failFirst: 10 })
  await openScanner(page)

  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 10000 })
  await expect(page.locator('.bsm-error')).toHaveCount(0)
})

test('shows an error and stops the camera when the detector keeps failing', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await openScanner(page)

  await expect(page.locator('.bsm-error')).toHaveText('The scanner stopped working.', { timeout: 10000 })
  expect(await cameraIsLive(page)).toBe(false)
})

test('a denied camera permission explains how to allow it', async ({ page }) => {
  await mockDevice(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
  })
  await openScanner(page)

  await expect(page.locator('.bsm-error')).toContainText('Allow the camera for this site')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('a page that is not allowed to use the camera says so without suggesting a retry', async ({ page }) => {
  // e.g. the app runs in an iframe without allow="camera": settings and retrying cannot help
  await mockDevice(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Blocked by policy', 'SecurityError'))
  })
  await openScanner(page)

  await expect(page.locator('.bsm-error')).toHaveText("This page isn't allowed to use the camera.", { timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
})

for (const [name, message] of [
  ['NotFoundError', 'No camera was found'],
  ['NotReadableError', 'in use by another app'],
]) {
  test(`${name} from the camera explains what to do and offers a retry`, async ({ page }) => {
    await mockDevice(page)
    await page.addInitScript((name) => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('x', name))
    }, name)
    await openScanner(page)

    await expect(page.locator('.bsm-error')).toContainText(message, { timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
}

test('a failed detector download can be retried', async ({ page }) => {
  // Without the native API the app downloads ZXing; the first download fails (e.g. offline)
  await mockDevice(page, { detector: 'none' })
  await page.route('**/*.wasm', (route) => route.abort())
  await openScanner(page)

  await expect(page.locator('.bsm-error')).toContainText('Check your connection', { timeout: 10000 })
  await page.unroute('**/*.wasm')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Point the camera at a barcode')).toBeVisible({ timeout: 15000 })
})

test('a browser without camera access shows an error instead of crashing', async ({ page }) => {
  // e.g. the page is served over plain HTTP, where navigator.mediaDevices does not exist
  await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { value: undefined }))
  await openScanner(page)

  await expect(page.locator('.bsm-error')).toContainText('secure (HTTPS) page')
  // Retrying cannot help, so the only way out is closing the modal
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
})

test('the scanner dialog is announced by name', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)

  await expect(page.getByRole('dialog', { name: 'Scan barcode' })).toBeVisible()
})

test('try again recovers after the detector stopped working', async ({ page }) => {
  // Fails exactly long enough to trigger the error, then works
  await mockDevice(page, { failFirst: 60 })
  await openScanner(page)
  await page.getByRole('button', { name: 'Try again' }).click({ timeout: 10000 })

  await expect(page.locator('.bsm-error')).toHaveCount(0)
  await expect(page.locator('.code')).toHaveText(CODE, { timeout: 10000 })
})

test('native engine never downloads ZXing', async ({ page }) => {
  const zxingRequests = []
  page.on('request', (r) => {
    if (/ponyfill|\.wasm/.test(r.url())) zxingRequests.push(r.url())
  })
  await mockDevice(page)
  await openScanner(page)

  await expect(page.getByText('Hold steady…')).toBeVisible()
  expect(zxingRequests).toEqual([])
})

test('ZXing engine starts downloading the WASM before the camera is ready', async ({ page }) => {
  await mockDevice(page, { detector: 'none', cameraDelayMs: 1500 })
  await openScanner(page, '/?debug')

  await expect(page.getByText('Point the camera at a barcode')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.bsm-debug-info')).toContainText('zxing-wasm')
  const { wasmStart, cameraReady } = await page.evaluate(() => ({
    wasmStart: performance.getEntriesByType('resource').find((e) => e.name.endsWith('.wasm'))?.startTime,
    cameraReady: window.__cameraReadyAt,
  }))
  expect(wasmStart).toBeLessThan(cameraReady)
})

test('does not download the ZXing WASM until the scanner opens', async ({ page }) => {
  await mockDevice(page, { detector: 'none' })
  const wasm = []
  page.on('request', (r) => r.url().endsWith('.wasm') && wasm.push(r.url()))
  await page.goto('/')
  await page.waitForTimeout(1000)
  expect(wasm).toEqual([])

  await page.getByRole('button', { name: 'Scan barcode' }).click()
  await expect.poll(() => wasm.length).toBeGreaterThan(0)
})

test('host styles with common class names do not leak into the scanner', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await page.goto('/')
  await page.addStyleTag({ content: '.panel, .error, .guide, .viewport { display: none !important }' })
  await page.getByRole('button', { name: 'Scan barcode' }).click()

  await expect(page.locator('.bsm-error')).toBeVisible({ timeout: 10000 })
})

test('host button styles do not misalign the retry button', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await page.goto('/')
  await page.addStyleTag({ content: 'main button { display: inline-flex; text-align: left; padding: 0 40px }' })
  await page.getByRole('button', { name: 'Scan barcode' }).click()

  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible({ timeout: 10000 })
  expect(
    await retry.evaluate((el) => {
      const s = getComputedStyle(el)
      return [s.display, s.textAlign, s.paddingLeft, s.paddingRight]
    }),
  ).toEqual(['block', 'center', '16px', '16px'])
})

// WCAG contrast ratio between two computed rgb() colors
const contrast = (a, b) => {
  const lum = (c) =>
    c
      .match(/\d+(\.\d+)?/g)
      .slice(0, 3)
      .map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('the retry button text meets WCAG AA contrast', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await openScanner(page)
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible({ timeout: 10000 })

  const { color, background } = await retry.evaluate((el) => {
    const s = getComputedStyle(el)
    return { color: s.color, background: s.backgroundColor }
  })
  expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
})

test('keyboard focus moves from Close to Try again in visual order', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await page.goto('/')
  // The style picker comes first and is a single Tab stop (arrows move between its radios)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Close' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeFocused()
})

test('a host can theme the scanner from any ancestor', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await page.goto('/')
  await page.addStyleTag({ content: ':root { --bsm-accent: rgb(10, 20, 200) }' })
  await page.getByRole('button', { name: 'Scan barcode' }).click()
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible({ timeout: 10000 })

  expect(await retry.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(10, 20, 200)')
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
  await expect(page.locator('.bsm-guide')).toBeVisible()

  const { view, guide } = await page.evaluate(() => ({
    view: document.querySelector('.bsm-viewport').getBoundingClientRect().toJSON(),
    guide: document.querySelector('.bsm-guide').getBoundingClientRect().toJSON(),
  }))
  expect(guide.top).toBeGreaterThanOrEqual(view.top)
  expect(guide.bottom).toBeLessThanOrEqual(view.bottom)
  // The camera keeps most of the screen instead of sharing it with a tall panel
  expect(view.width * view.height).toBeGreaterThan(844 * 390 * 0.6)
})

test('in portrait the scan area takes 80% of the camera width', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)
  await expect(page.locator('.bsm-guide')).toBeVisible()

  const ratio = await page.evaluate(
    () => document.querySelector('.bsm-guide').offsetWidth / document.querySelector('.bsm-viewport').clientWidth,
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
  await expect(page.locator('.bsm-guide')).toBeVisible()

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
  await expect(page.locator('.bsm-debug-info')).toContainText('zxing-wasm · video 1280x720')

  const [crop, guide] = await Promise.all(
    ['.bsm-debug-crop', '.bsm-guide'].map((s) => page.locator(s).evaluate((el) => el.getBoundingClientRect().toJSON())),
  )
  // The red area must match the white guide (border width aside)
  for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(crop[k] - guide[k])).toBeLessThan(4)
})

test('debug overlay is hidden without ?debug', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)
  await expect(page.getByText('Hold steady…')).toBeVisible()
  await expect(page.locator('.bsm-debug')).toHaveCount(0)
  // The engine is developer information: end users never see it.
  // Counted once, not retried: after the confirmation the modal closes and the text would vanish anyway.
  expect(await page.getByText(/Engine/).count()).toBe(0)
})

test('with reduced motion the camera feed does not zoom toward the code', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockDevice(page)
  await openScanner(page)
  await expect(page.getByText('Hold steady…')).toBeVisible()

  expect(await page.locator('video').evaluate((v) => getComputedStyle(v).transform)).toBe('none')
  // The confirmation ring is progress feedback, so it still animates
  await expect(page.locator('.bsm-ring-fill')).toBeVisible()
})

// Opens the demo page, picks a scanner style by its label and opens the scanner
async function openThemed(page, style) {
  await page.goto('/')
  await page.getByLabel(style, { exact: true }).check()
  await page.getByRole('button', { name: 'Scan barcode' }).click()
}

// Background actually painted behind an element: its own or the nearest ancestor's that is not transparent
const paintedBackground = (locator) =>
  locator.evaluate((el) => {
    for (let n = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor
      if (!/^rgba\(.*, 0\)$|^transparent$/.test(bg)) return bg
    }
    return 'rgb(255, 255, 255)'
  })

test('the scanner uses the standard theme unless the host picks another', async ({ page }) => {
  await mockDevice(page)
  await openScanner(page)

  await expect(page.locator('dialog.bsm-scanner')).toHaveAttribute('data-theme', 'standard')
})

for (const style of ['Standard', 'Shelf', 'Receipt', 'Datamatics', 'Coupon']) {
  test(`the ${style} theme keeps the retry button and error text at WCAG AA`, async ({ page }) => {
    await mockDevice(page, { failFirst: null })
    await openThemed(page, style)
    const retry = page.getByRole('button', { name: 'Try again' })
    await expect(retry).toBeVisible({ timeout: 10000 })
    await expect(page.locator('dialog.bsm-scanner')).toHaveAttribute('data-theme', style.toLowerCase())

    const button = await retry.evaluate((el) => {
      const s = getComputedStyle(el)
      return { color: s.color, background: s.backgroundColor }
    })
    expect(contrast(button.color, button.background)).toBeGreaterThanOrEqual(4.5)

    const error = page.locator('.bsm-error')
    const errorColor = await error.evaluate((el) => getComputedStyle(el).color)
    expect(contrast(errorColor, await paintedBackground(error))).toBeGreaterThanOrEqual(4.5)
  })
}

test('a host token still wins over a built-in theme', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  await page.goto('/')
  await page.addStyleTag({ content: ':root { --bsm-accent: rgb(10, 20, 200) }' })
  await page.getByLabel('Receipt', { exact: true }).check()
  await page.getByRole('button', { name: 'Scan barcode' }).click()
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible({ timeout: 10000 })

  expect(await retry.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(10, 20, 200)')
})

test('themes with their own accent change the retry button', async ({ page }) => {
  await mockDevice(page, { failFirst: null })
  const retryBackground = async (style) => {
    await openThemed(page, style)
    const retry = page.getByRole('button', { name: 'Try again' })
    await expect(retry).toBeVisible({ timeout: 10000 })
    return retry.evaluate((el) => getComputedStyle(el).backgroundColor)
  }

  expect(await retryBackground('Shelf')).not.toBe(await retryBackground('Standard'))
})
