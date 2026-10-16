import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Si App falla al renderizar, muestra el error en lugar de una pantalla en blanco
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="demo">
        <p className="error">Something went wrong: {this.state.error.message}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
