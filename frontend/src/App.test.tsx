import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./pages/DashboardPage', () => ({
  default: () => <h1>Panel de ventas</h1>,
}))

describe('App access control', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirige al login cuando no existe una sesión', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('impide que un vendedor abra la administración de usuarios', async () => {
    localStorage.setItem('salesia_user', JSON.stringify({
      id: 2,
      full_name: 'Vendedor de prueba',
      email: null,
      dni: '12345678',
      role: 'seller',
      company_id: 1,
      is_active: true,
      password_configured: true,
    }))

    render(
      <MemoryRouter initialEntries={['/usuarios']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Panel de ventas' })).toBeInTheDocument()
    expect(screen.queryByText('Gestión de usuarios')).not.toBeInTheDocument()
  })
})