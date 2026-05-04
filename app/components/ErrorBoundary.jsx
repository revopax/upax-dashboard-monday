'use client'
import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || 'unknown', error, info)
  }

  render() {
    if (this.state.hasError) {
      const isSection = !!this.props.name
      return (
        <div role="alert" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: isSection ? '20vh' : '40vh', gap: 16, padding: isSection ? 20 : 32,
          background: 'rgba(255,59,48,.04)', borderRadius: 'var(--r)', border: '1px solid rgba(255,59,48,.15)',
        }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <p style={{ color: 'var(--red)', fontWeight: 600, fontSize: isSection ? 13 : 16, textAlign: 'center' }}>
            {isSection ? `Error en ${this.props.name}` : 'Algo salio mal al renderizar este modulo.'}
          </p>
          <pre style={{
            fontSize: 'var(--ts-base)', background: 'var(--bg2)', padding: '8px 12px',
            borderRadius: 'var(--r-xs)', maxWidth: 600, overflow: 'auto', color: 'var(--tx2)',
            fontFamily: 'var(--mono)', lineHeight: 1.5,
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: 'var(--r-sm)', border: 'none',
              background: 'var(--blue)', color: '#fff',
              fontWeight: 600, cursor: 'pointer', fontSize: 'var(--ts-lg)',
              fontFamily: 'var(--sans)',
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
