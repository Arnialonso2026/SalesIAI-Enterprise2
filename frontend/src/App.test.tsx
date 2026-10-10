import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./pages/DashboardPage', () => ({
  default: () => <h1>Panel de ventas</h1>,
}))
vi.mock('./pages/PaymentReceiptsPage', () => ({ default: () => <h1>Comprobantes de pago</h1> }))
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
    expect(screen.queryByRole('link', { name: 'Sucursales' })).not.toBeInTheDocument()
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
    const branchesLink = screen.getByRole('link', { name: 'Sucursales' })
    expect(usersLink).toHaveClass('active')
    expect(auditLink).toBeInTheDocument()
    expect(documentationLink).toBeInTheDocument()
    expect(branchesLink).toHaveAttribute('href', '/sucursales')
    expect(screen.getByRole('heading', { name: 'Ventas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inventarios' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reportes y analítica' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mantenimientos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Administración' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Compras' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Órdenes de venta' })).toHaveAttribute('href', '/ventas/nueva')
    expect(screen.getByRole('link', { name: 'Comprobantes de pago' })).toHaveAttribute('href', '/comprobantes-pago')
    expect(screen.getByRole('link', { name: 'Cuentas por cobrar' })).toHaveAttribute('href', '/cuentas-cobrar')
    expect(screen.queryByRole('link', { name: 'Proveedores' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' }).closest('.nav-section')).toBe(
      screen.getByRole('navigation').querySelector('.nav-section'),
    )
    expect(screen.queryByRole('heading', { name: 'Compras' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stock y Kardex' })).toHaveAttribute('href', '/inventario')
    expect(screen.getByRole('link', { name: 'Analítica' })).toHaveAttribute('href', '/analitica')
    expect(screen.queryByRole('link', { name: 'Variación y dirección' })).not.toBeInTheDocument()
    expect(auditLink.closest('.nav-section-links')).toBe(usersLink.closest('.nav-section-links'))
    expect(documentationLink.closest('.nav-section-links')).toBe(usersLink.closest('.nav-section-links'))
    expect(screen.getByRole('link', { name: 'Clientes' }).closest('.nav-section-links')).toBe(
      screen.getByRole('link', { name: 'Categorías' }).closest('.nav-section-links'),
    )
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

  it('alterna el tema desde el encabezado y conserva la elección', async () => {
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

    const toggle = await screen.findByRole('button', { name: /cambiar a tema (claro|oscuro)/i })
    const nextTheme = toggle.getAttribute('aria-label')?.endsWith('oscuro') ? 'dark' : 'light'
    await userEvent.click(toggle)

    expect(localStorage.getItem('salesia_theme')).toBe(nextTheme)
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe(nextTheme))
  })
})