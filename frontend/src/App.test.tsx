import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./pages/DashboardPage', () => ({
  default: () => <h1>Panel de ventas</h1>,
}))
vi.mock('./pages/AuditPage', () => ({ default: () => <h1>Auditoría</h1> }))
vi.mock('./pages/DocumentationPage', () => ({ default: () => <h1>Documentación</h1> }))
vi.mock('./pages/SettingsPage', () => ({ default: () => <h1>Ajustes</h1> }))

describe('App access control', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirige al login cuando no existe una sesión', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('protege una URL directa y conserva la ruta solicitada', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('muestra la landing sin una sesión', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { level: 1, name: /tu operación/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toHaveLength(3)
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })[0]).toHaveAttribute('href', '/login')
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

    expect(await screen.findByRole('heading', { level: 1, name: /tu operación/i })).toBeInTheDocument()
    expect(screen.queryByText('Gestión de usuarios')).not.toBeInTheDocument()
  })

  it('muestra auditoría y documentación como opciones independientes', async () => {
    localStorage.setItem('salesia_user', JSON.stringify({
      id: 1,
      full_name: 'Administrador de prueba',
      email: null,
      dni: '12345678',
      role: 'admin',
      company_id: 1,
      is_active: true,
      password_configured: true,
    }))

    render(
      <MemoryRouter initialEntries={['/usuarios']}>
        <App />
      </MemoryRouter>,
    )

    const usersLink = await screen.findByRole('link', { name: 'Usuarios' })
    const auditLink = screen.getByRole('link', { name: 'Auditoría' })
    const documentationLink = screen.getByRole('link', { name: 'Documentación' })
    expect(usersLink).toHaveClass('active')
    expect(auditLink).toBeInTheDocument()
    expect(documentationLink).toBeInTheDocument()
    expect(auditLink.parentElement).toBe(usersLink.parentElement)
    expect(documentationLink.parentElement).toBe(usersLink.parentElement)
    expect(screen.queryByRole('navigation', { name: 'Submenu de Usuarios' })).not.toBeInTheDocument()
  })

  it('abre el menú de usuario y permite abrir ajustes', async () => {
    localStorage.setItem('salesia_user', JSON.stringify({
      id: 1,
      full_name: 'Administrador de prueba',
      email: null,
      dni: '12345678',
      role: 'admin',
      company_id: 1,
      is_active: true,
      password_configured: true,
    }))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir menú de usuario' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /ajustes/i }))

    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
  })
})