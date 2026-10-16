import { useState } from 'react'
import BarcodeScannerModal from './BarcodeScanner.jsx'

// Modo de prueba: agregar ?debug a la URL de la demo marca el área analizada (rojo) y el código detectado (verde)
const debug = new URLSearchParams(location.search).has('debug')

// Estilos del escáner que se pueden probar en la demo: valor de la prop theme → texto del selector
const THEMES = { standard: 'Standard', shelf: 'Shelf', receipt: 'Receipt', datamatics: 'Datamatics', coupon: 'Coupon' }

// Demo: elige el estilo, abre el escáner y muestra el código que devuelve
export default function App() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState('standard')
  const [result, setResult] = useState(null) // { code, format }

  return (
    <main className="demo">
      <fieldset className="themes">
        <legend>Scanner style</legend>
        {Object.entries(THEMES).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <button onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M13 9v6M16 9v6" />
        </svg>
        Scan barcode
      </button>
      {result && (
        <dl className="result">
          <div>
            <dt>Code</dt>
            <dd className="code">{result.code}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{result.format}</dd>
          </div>
        </dl>
      )}
      <BarcodeScannerModal
        open={open}
        debug={debug}
        theme={theme}
        onClose={() => setOpen(false)}
        onScan={(code, format) => {
          setResult({ code, format })
          setOpen(false)
        }}
      />
    </main>
  )
}
