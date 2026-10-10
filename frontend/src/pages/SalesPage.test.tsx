import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SalesPage from './SalesPage'

function CurrentPath() {
  const location = useLocation()
  return <output aria-label="Ruta actual">{location.pathname}</output>
}

describe('SalesPage', () => {
  it('redirige el historial anterior al módulo de cuentas por cobrar', async () => {
    render(<MemoryRouter initialEntries={['/ventas']}>
      <Routes>
        <Route path="/ventas" element={<SalesPage />} />
        <Route path="/cuentas-cobrar" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>)

    expect(await screen.findByLabelText('Ruta actual')).toHaveTextContent('/cuentas-cobrar')
  })
})
