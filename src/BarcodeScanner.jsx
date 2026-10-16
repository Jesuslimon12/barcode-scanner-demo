import { useEffect, useRef, useState } from 'react'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import './BarcodeScanner.css'

const CONFIRM_MS = 3000 // tiempo que tarda en llenarse el spinner una vez detectado un código
// Pasa CONFIRM_MS a la animación del anillo en BarcodeScanner.css, así el tiempo vive en un solo lugar
const RING_STYLE = { '--confirm-ms': `${CONFIRM_MS}ms` }
// Debe ser menor que CONFIRM_MS; si no, un código perdido igual se confirma. Subir ambos si iOS decodifica muy lento.
const LOST_MS = 500 // se cancela la detección si el código no se ve durante este tiempo
const MAX_ZOOM = 3 // zoom máximo permitido
const MOVE_TOLERANCE = 0.2 // se cancela si el centro del código se aleja más de esta proporción de su ancho
const MAX_FAILURES = 60 // fallos seguidos del detector (~1-2 s) antes de mostrar un error
const TARGET_FILL = 0.7 // hacer zoom hasta que el código ocupe esta proporción del ancho de la pantalla
// Área de escaneo, centrada en la pantalla. Mantener sincronizado con .guide en BarcodeScanner.css.
const GUIDE_WIDTH = 0.8 // proporción del ancho de la pantalla
const GUIDE_RATIO = 2 // ancho / alto
// Solo códigos de barras lineales (1D): se ignoran QR, Data Matrix, Aztec y PDF417
const FORMATS = ['codabar', 'code_39', 'code_93', 'code_128', 'ean_8', 'ean_13', 'itf', 'upc_a', 'upc_e']

// Todos los textos visibles; la app puede reemplazar cualquiera con la prop labels (p. ej. para traducirlos)
const DEFAULT_LABELS = {
  title: 'Scan barcode',
  close: 'Close',
  starting: 'Starting camera…',
  aim: 'Point the camera at a barcode',
  holdSteady: 'Hold steady…',
  retry: 'Try again',
  errorPermission: 'Camera access is blocked. Allow the camera for this site in your browser settings, then try again.',
  errorNoCamera: 'No camera was found. Connect a camera or use a device that has one.',
  errorCameraBusy: 'The camera is in use by another app. Close that app, then try again.',
  errorUnsupported: "This browser can't open the camera here. Use an up-to-date browser on a secure (HTTPS) page.",
  errorUnavailable: "The scanner couldn't start. Check your connection, then try again.",
  errorStopped: 'The scanner stopped working. Try again.',
}

// Traduce el error de getUserMedia (o de la descarga del detector) a la clave de labels que lo explica
function errorLabel(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'errorPermission'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'errorNoCamera'
    case 'NotReadableError':
    case 'AbortError':
      return 'errorCameraBusy'
    case 'NotSupportedError':
      return 'errorUnsupported'
    default:
      return 'errorUnavailable'
  }
}

// Detector nativo donde existe (Chrome en Android), ZXing en WASM en el resto (Safari en iOS).
// ponytail: en Android sin Google Play Services (Huawei, ROMs sin GApps, algunas terminales AOSP) la API
// puede existir sin soportar formatos y nunca detectar nada. Si hace falta, elegir el motor con
// (await BarcodeDetector.getSupportedFormats()).length > 0.
// Nada en este módulo toca window al importarse: así se puede importar en apps con SSR (Next.js, Remix).
let detectorReady = null
// ZXing solo se descarga si hace falta, la primera vez que se abre el escáner y antes de pedir la cámara:
// así baja en paralelo con el permiso sin cargar 1 MB en cada página de la app que lo usa.
// El .wasm se sirve desde nuestro propio servidor en lugar del CDN jsDelivr por defecto.
function loadDetector() {
  detectorReady ??= globalThis.BarcodeDetector
    ? Promise.resolve(globalThis.BarcodeDetector)
    : import('barcode-detector/ponyfill')
        .then(({ BarcodeDetector, prepareZXingModule }) =>
          prepareZXingModule({
            overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
            fireImmediately: true,
          }).then(() => BarcodeDetector),
        )
        .catch((e) => {
          detectorReady = null // si falló la descarga (p. ej. sin conexión), "Try again" vuelve a intentarla
          throw e
        })
  return detectorReady
}

// Circunferencia del anillo (r = 54), usada como stroke-dasharray
const RING = 2 * Math.PI * 54

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// true si el código se desplazó desde su posición inicial más de lo que tolera el pulso de la mano
function hasMoved(box, from) {
  const dx = box.x + box.width / 2 - (from.x + from.width / 2)
  const dy = box.y + box.height / 2 - (from.y + from.height / 2)
  return Math.hypot(dx, dy) > MOVE_TOLERANCE * from.width
}

// Traduce el recuadro de la pantalla a coordenadas del video, para que el escáner sepa qué parte de la imagen analizar.
// Devuelve { x, y, width, height } en píxeles del video, compensando el recorte de object-fit: cover.
function guideCrop(video, el) {
  const W = el.clientWidth
  const H = el.clientHeight
  const s = Math.max(W / video.videoWidth, H / video.videoHeight)
  const gw = Math.min(GUIDE_WIDTH * W, GUIDE_WIDTH * GUIDE_RATIO * H) // igual que el min() de .guide
  const gh = gw / GUIDE_RATIO
  const toVideo = (px, size, vSize) => (px - (size - vSize * s) / 2) / s
  const x = clamp(toVideo((W - gw) / 2, W, video.videoWidth), 0, video.videoWidth)
  const y = clamp(toVideo((H - gh) / 2, H, video.videoHeight), 0, video.videoHeight)
  return {
    x,
    y,
    width: Math.min(gw / s, video.videoWidth - x),
    height: Math.min(gh / s, video.videoHeight - y),
  }
}

// Pasa un rectángulo en píxeles del video a píxeles de pantalla (sin zoom), compensando object-fit: cover
function toScreen(r, video, el) {
  const s = Math.max(el.clientWidth / video.videoWidth, el.clientHeight / video.videoHeight)
  const ox = (el.clientWidth - video.videoWidth * s) / 2
  const oy = (el.clientHeight - video.videoHeight * s) / 2
  return `left:${ox + r.x * s}px;top:${oy + r.y * s}px;width:${r.width * s}px;height:${r.height * s}px`
}

// Convierte la posición del código (en píxeles del video) en un transform CSS que lo
// mueve hacia el centro y lo agranda, compensando el recorte de object-fit: cover.
// El desplazamiento se limita para que el video siempre cubra la pantalla (sin bordes negros).
function zoomTransform(box, video, el) {
  const W = el.clientWidth
  const H = el.clientHeight
  const s = Math.max(W / video.videoWidth, H / video.videoHeight)
  const cx = (box.x + box.width / 2) * s + (W - video.videoWidth * s) / 2
  const cy = (box.y + box.height / 2) * s + (H - video.videoHeight * s) / 2
  const z = clamp((TARGET_FILL * W) / (box.width * s), 1, MAX_ZOOM)
  const tx = clamp(W / 2 - z * cx, W - z * W, 0)
  const ty = clamp(H / 2 - z * cy, H - z * H, 0)
  // Los porcentajes mantienen el encuadre correcto si la pantalla cambia de tamaño después
  return { transform: `translate(${(tx / W) * 100}%, ${(ty / H) * 100}%) scale(${z})` }
}

function Scanner({ onScan, onRetry, debug, labels }) {
  const videoRef = useRef(null)
  const viewRef = useRef(null)
  const debugRef = useRef(null)
  const [locked, setLocked] = useState(null) // código detectado actualmente, o null
  // phase: starting (iniciando) | scanning (escaneando) | result (resultado, con code y format) | error (con label, la clave del texto)
  const [state, setState] = useState({ phase: 'starting' })
  const { phase } = state
  // El efecto corre una sola vez: se guarda el último onScan para no llamar a uno viejo
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  })

  useEffect(() => {
    const video = videoRef.current
    let detector = null
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    let stream = null
    let stopped = false
    let paused = false
    let lock = null // código detectado actualmente: { code, format, box (posición inicial), start (inicio), lastSeen (última vez visto) }
    let raf = 0
    let failures = 0 // fallos seguidos del detector

    // Cancela la detección actual: oculta el spinner y quita el zoom
    const reset = () => {
      cancelAnimationFrame(raf)
      lock = null
      setLocked(null)
      video.style.transform = ''
      if (debug) debugRef.current.style.transform = ''
    }

    // Se ejecuta en cada frame mientras hay un código detectado: confirma al cumplirse CONFIRM_MS.
    // El spinner lo anima CSS; acá no se toca el estado de React para no re-renderizar en cada frame.
    const tick = () => {
      if (!lock) return
      const now = performance.now()
      if (now - lock.lastSeen > LOST_MS) return reset()
      if (now - lock.start < CONFIRM_MS) {
        raf = requestAnimationFrame(tick)
        return
      }
      paused = true
      video.pause()
      // ponytail: vibración desactivada; no existe en iOS y en Android requiere que el usuario haya tocado la página.
      // Para activarla: navigator.vibrate?.(80)
      setState({ phase: 'result', code: lock.code, format: lock.format })
      onScanRef.current?.(lock.code, lock.format)
    }

    // Se llama cada vez que el detector encuentra un código dentro del recuadro
    const onDetect = (barcode, crop) => {
      const now = performance.now()
      const b = barcode.boundingBox
      // La posición viene relativa al recorte; se ajusta a coordenadas del video completo
      const box = { x: b.x + crop.x, y: b.y + crop.y, width: b.width, height: b.height }
      // Mismo código pero desplazado: se cancela. El próximo frame empieza de nuevo desde la nueva posición.
      const moved = lock?.code === barcode.rawValue && hasMoved(box, lock.box)
      if (moved) reset()
      // Directo al DOM: cambia en cada frame y no necesita re-render
      video.style.transform = zoomTransform(box, video, viewRef.current).transform
      if (debug) {
        debugRef.current.style.transform = video.style.transform // la capa sigue al zoom del video
        debugRef.current.querySelector('.bsm-debug-box').style.cssText = toScreen(box, video, viewRef.current)
      }
      if (moved) return
      if (lock?.code === barcode.rawValue) {
        lock.lastSeen = now
        return
      }
      // Código distinto o primero: reinicia el spinner
      const isNew = !lock
      lock = { code: barcode.rawValue, format: barcode.format, box, start: now, lastSeen: now }
      setLocked(barcode.rawValue)
      if (isNew) raf = requestAnimationFrame(tick)
    }

    // Bucle secuencial: el siguiente frame se analiza solo cuando termina el anterior.
    const loop = async () => {
      if (stopped) return
      if (!paused && video.readyState >= 2) {
        try {
          // Analiza solo el área del recuadro: ignora códigos de afuera y es más liviano en iOS
          const crop = guideCrop(video, viewRef.current)
          if (debug) {
            debugRef.current.querySelector('.bsm-debug-crop').style.cssText = toScreen(crop, video, viewRef.current)
            viewRef.current.querySelector('.bsm-debug-info').textContent =
              `video ${video.videoWidth}x${video.videoHeight} · crop ${Math.round(crop.width)}x${Math.round(crop.height)}`
          }
          // Asignar el tamaño reinicia el canvas aunque sea el mismo valor; solo se hace si cambió (p. ej. al rotar)
          const w = Math.round(crop.width)
          const h = Math.round(crop.height)
          if (canvas.width !== w) canvas.width = w
          if (canvas.height !== h) canvas.height = h
          ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
          const [barcode] = await detector.detect(canvas)
          failures = 0 // solo cuenta fallos del detector, no de onDetect
          if (barcode && !paused) onDetect(barcode, crop)
        } catch (e) {
          // Un frame puede fallar mientras la cámara se estabiliza; se intenta con el siguiente.
          // Si falla MAX_FAILURES veces seguidas, el error es permanente: se avisa en lugar de fallar en silencio.
          if (++failures >= MAX_FAILURES) {
            stopped = true
            stream?.getTracks().forEach((t) => t.stop())
            console.error('BarcodeScanner: detector stopped working', e) // el detalle técnico queda para el desarrollador
            setState({ phase: 'error', label: 'errorStopped' })
            return
          }
        }
      }
      requestAnimationFrame(loop)
    }

    const detectorLoad = loadDetector() // arranca ya: baja mientras el usuario responde el permiso de cámara
    detectorLoad.catch(() => {}) // el error se muestra abajo, cuando se espera el detector
    // Sin HTTPS (o en navegadores viejos) navigator.mediaDevices no existe: se muestra el error en lugar de romper
    const camera = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
      : Promise.reject(new DOMException('navigator.mediaDevices is not available', 'NotSupportedError'))
    camera
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.srcObject = s
        await video.play()
        const Detector = await detectorLoad
        if (stopped) return
        detector = new Detector({ formats: FORMATS })
        setState({ phase: 'scanning' })
        loop()
      })
      .catch((e) => {
        if (stopped) return
        stream?.getTracks().forEach((t) => t.stop())
        console.error('BarcodeScanner: could not start', e)
        setState({ phase: 'error', label: errorLabel(e) })
      })

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [debug])

  return (
    <>
      <div className="bsm-viewport" ref={viewRef}>
        {/* ponytail: zoom solo visual; el zoom de la cámara agregaría resolución pero mueve la posición del código */}
        <video ref={videoRef} playsInline muted />
        {debug && (
          <>
            <div className="bsm-debug" ref={debugRef} aria-hidden="true">
              <div className="bsm-debug-crop" />
              <div className="bsm-debug-box" />
            </div>
            <p className="bsm-debug-info" />
          </>
        )}
        {phase === 'scanning' && <div className={`bsm-guide${locked !== null ? ' bsm-locked' : ''}`} aria-hidden="true" />}
        {phase === 'scanning' && locked !== null && (
          <svg className="bsm-ring" viewBox="0 0 120 120" aria-hidden="true" style={RING_STYLE}>
            <circle cx="60" cy="60" r="54" className="bsm-ring-track" />
            {/* key: un código nuevo remonta el círculo y la animación arranca de cero */}
            <circle key={locked} cx="60" cy="60" r="54" className="bsm-ring-fill" strokeDasharray={RING} />
          </svg>
        )}
      </div>

      <section className="bsm-panel" aria-live="polite">
        {phase === 'starting' && <p>{labels.starting}</p>}
        {phase === 'scanning' && <p>{locked !== null ? labels.holdSteady : labels.aim}</p>}
        {phase === 'error' && (
          <>
            <p className="bsm-error">{labels[state.label]}</p>
            {/* Sin acceso a la cámara en este navegador, reintentar no cambia nada */}
            {state.label !== 'errorUnsupported' && <button onClick={onRetry}>{labels.retry}</button>}
          </>
        )}
        {phase === 'result' && (
          <>
            <p className="bsm-code">{state.code}</p>
            <p>{state.format}</p>
          </>
        )}
        <p className="bsm-engine">Engine: {globalThis.BarcodeDetector ? 'native' : 'zxing-wasm'}</p>
      </section>
    </>
  )
}

// Modal a pantalla completa que escanea un código de barras y lo devuelve con onScan(code, format).
// open lo controla el padre; onClose se llama al tocar la X o con Escape. La cámara solo se enciende mientras está abierto.
// debug marca el área analizada (rojo) y el código detectado (verde); la app decide cuándo activarlo.
// labels reemplaza cualquier texto de DEFAULT_LABELS, p. ej. labels={{ title: 'Escanear código' }}.
export default function BarcodeScannerModal({ open, onClose, onScan, debug = false, labels }) {
  const dialogRef = useRef(null)
  const text = { ...DEFAULT_LABELS, ...labels }
  const [attempt, setAttempt] = useState(0) // cambiarlo remonta el escáner: reinicia cámara, lector y estado

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="bsm-scanner"
      aria-label={text.title}
      onCancel={(e) => {
        e.preventDefault() // Escape: el padre decide si se cierra, a través de open
        onClose?.()
      }}
    >
      {open && (
        <Scanner key={attempt} onScan={onScan} debug={debug} labels={text} onRetry={() => setAttempt((a) => a + 1)} />
      )}
      <button className="bsm-scanner-close" aria-label={text.close} onClick={() => onClose?.()}>
        ×
      </button>
    </dialog>
  )
}
