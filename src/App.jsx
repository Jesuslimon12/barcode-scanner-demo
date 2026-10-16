import { useState } from 'react'
import BarcodeScannerModal from './BarcodeScanner.jsx'

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
        onClose={() => setOpen(false)}
        onScan={(code, format) => {
          setResult({ code, format })
          setOpen(false)
        }}
      />
    </main>
  )
}
