import { useEffect, useRef, useState } from 'react'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

const CONFIRM_MS = 3000 // tiempo que tarda en llenarse el spinner una vez detectado un código
// Pasa CONFIRM_MS a la animación del anillo en index.css, así el tiempo vive en un solo lugar
const RING_STYLE = { '--confirm-ms': `${CONFIRM_MS}ms` }
// Debe ser menor que CONFIRM_MS; si no, un código perdido igual se confirma. Subir ambos si iOS decodifica muy lento.
const LOST_MS = 500 // se cancela la detección si el código no se ve durante este tiempo
const MAX_ZOOM = 3 // zoom máximo permitido
const TARGET_FILL = 0.7 // hacer zoom hasta que el código ocupe esta proporción del ancho de la pantalla
// Área de escaneo, centrada en la pantalla. Mantener sincronizado con .guide en index.css.
const GUIDE_WIDTH = 0.8 // proporción del ancho de la pantalla
const GUIDE_RATIO = 2 // ancho / alto

// Detector nativo donde existe (Chrome en Android), ZXing en WASM en el resto (Safari en iOS).
// ponytail: en Android sin Google Play Services (Huawei, ROMs sin GApps, algunas terminales AOSP) la API
// puede existir sin soportar formatos y nunca detectar nada. Si hace falta, elegir el motor con
// (await BarcodeDetector.getSupportedFormats()).length > 0.
const engine = globalThis.BarcodeDetector ? 'native' : 'zxing-wasm'
// ZXing solo se descarga si hace falta, y arranca al cargar la página: así baja en paralelo con el permiso de cámara.
// El .wasm se sirve desde nuestro propio servidor en lugar del CDN jsDelivr por defecto.
const detectorReady = globalThis.BarcodeDetector
  ? Promise.resolve(globalThis.BarcodeDetector)
  : import('barcode-detector/ponyfill').then(({ BarcodeDetector, prepareZXingModule }) =>
      prepareZXingModule({
        overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
        fireImmediately: true,
      }).then(() => BarcodeDetector),
    )

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Traduce el recuadro de la pantalla a coordenadas del video, para que el escáner sepa qué parte de la imagen analizar.
// Devuelve { x, y, width, height } en píxeles del video, compensando el recorte de object-fit: cover.
function guideCrop(video, el) {
  const W = el.clientWidth
  const H = el.clientHeight
  const s = Math.max(W / video.videoWidth, H / video.videoHeight)
  const gw = GUIDE_WIDTH * W
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

export default function App() {
  const videoRef = useRef(null)
  const viewRef = useRef(null)
  const controls = useRef(null)
  const [locked, setLocked] = useState(null) // código detectado actualmente, o null
  const [phase, setPhase] = useState('starting') // starting (iniciando) | scanning (escaneando) | result (resultado) | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const video = videoRef.current
    let detector = null
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    let stream = null
    let stopped = false
    let paused = false
    let lock = null // código detectado actualmente: { code, format, start (inicio), lastSeen (última vez visto) }
    let raf = 0

    // Cancela la detección actual: oculta el spinner y quita el zoom
    const reset = () => {
      cancelAnimationFrame(raf)
      lock = null
      setLocked(null)
      video.style.transform = ''
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
      navigator.vibrate?.(80)
      // ponytail: llamada al endpoint simulada, agregar aquí fetch(`/api/products/${lock.code}`)
      setResult({ code: lock.code, format: lock.format })
      setPhase('result')
    }

    // Se llama cada vez que el detector encuentra un código dentro del recuadro
    const onDetect = (barcode, crop) => {
      const now = performance.now()
      const b = barcode.boundingBox
      // La posición viene relativa al recorte; se ajusta a coordenadas del video completo
      const box = { x: b.x + crop.x, y: b.y + crop.y, width: b.width, height: b.height }
      // Directo al DOM: cambia en cada frame y no necesita re-render
      video.style.transform = zoomTransform(box, video, viewRef.current).transform
      if (lock?.code === barcode.rawValue) {
        lock.lastSeen = now
        return
      }
      // Código distinto o primero: reinicia el spinner
      const isNew = !lock
      lock = { code: barcode.rawValue, format: barcode.format, start: now, lastSeen: now }
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
          canvas.width = Math.round(crop.width)
          canvas.height = Math.round(crop.height)
          ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
          const [barcode] = await detector.detect(canvas)
          if (barcode && !paused) onDetect(barcode, crop)
        } catch {
          // un frame puede fallar mientras la cámara se estabiliza; se intenta con el siguiente
        }
      }
      requestAnimationFrame(loop)
    }

    controls.current = {
      scanAgain: () => {
        reset()
        paused = false
        video.play()
      },
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        video.srcObject = s
        await video.play()
        const Detector = await detectorReady // en iOS ya viene descargándose desde que cargó la página
        if (stopped) return
        detector = new Detector() // sin formats: acepta todos los formatos soportados
        setPhase('scanning')
        loop()
      })
      .catch((e) => {
        if (stopped) return
        stream?.getTracks().forEach((t) => t.stop())
        setError(`Scanner unavailable: ${e?.message ?? e}`)
        setPhase('error')
      })

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function scanAgain() {
    setResult(null)
    setPhase('scanning')
    controls.current?.scanAgain()
  }

  const ring = 2 * Math.PI * 54

  return (
    <main className="app">
      <div className="viewport" ref={viewRef}>
        {/* ponytail: zoom solo visual; el zoom de la cámara agregaría resolución pero mueve la posición del código */}
        <video ref={videoRef} playsInline muted />
        {phase === 'scanning' && <div className={`guide${locked !== null ? ' locked' : ''}`} aria-hidden="true" />}
        {phase === 'scanning' && locked !== null && (
          <svg className="ring" viewBox="0 0 120 120" aria-hidden="true" style={RING_STYLE}>
            <circle cx="60" cy="60" r="54" className="ring-track" />
            {/* key: un código nuevo remonta el círculo y la animación arranca de cero */}
            <circle key={locked} cx="60" cy="60" r="54" className="ring-fill" strokeDasharray={ring} />
          </svg>
        )}
      </div>

      <section className="panel" aria-live="polite">
        {phase === 'starting' && <p>Starting camera…</p>}
        {phase === 'scanning' && (
          <p>{locked !== null ? 'Hold steady…' : 'Point the camera at a barcode'}</p>
        )}
        {phase === 'error' && <p className="error">{error}</p>}
        {phase === 'result' && (
          <>
            <p className="code">{result.code}</p>
            <p>{result.format}</p>
            <p className="success">Endpoint consultado</p>
            <button onClick={scanAgain}>Scan again</button>
          </>
        )}
        <p className="engine">Engine: {engine}</p>
      </section>
    </main>
  )
}
