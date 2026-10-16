import { useState } from 'react'
import BarcodeScannerModal from './BarcodeScanner.jsx'

// Modo de prueba: agregar ?debug a la URL de la demo marca el área analizada (rojo) y el código detectado (verde)
const debug = new URLSearchParams(location.search).has('debug')

// Demo: abre el escáner y muestra el código que devuelve
export default function App() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(null) // { code, format }

  return (
    <main className="demo">
      <button onClick={() => setOpen(true)}>Scan barcode</button>
      {result && (
        <>
          <p className="code">{result.code}</p>
          <p>{result.format}</p>
        </>
      )}
      <BarcodeScannerModal
        open={open}
        debug={debug}
        onClose={() => setOpen(false)}
        onScan={(code, format) => {
          setResult({ code, format })
          setOpen(false)
        }}
      />
    </main>
  )
}
