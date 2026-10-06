import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../App', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.get.mockReset()
  })

  it('presenta indicadores y acceso a registrar una venta', async () => {
    mocks.get.mockResolvedValue({
      data: {
        total_revenue: 1250,
        month_revenue: 450,
        today_sales: 2,
        sales_count: 5,
        customers_count: 8,
        low_stock_count: 0,
        daily_sales: [],
        recent_sales: [],
      },
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Resumen ejecutivo' })).toBeInTheDocument()
    expect(screen.getByText('Clientes activos')).toBeInTheDocument()
    expect(screen.getByText((_content, element) => (
      element?.tagName === 'P'
      && element.textContent?.replace(/\s+/g, ' ').trim() === 'Has registrado 5 ventas y generado S/ 1,250.00 en ingresos acumulados.'
    ))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /registrar venta/i })).toHaveAttribute('href', '/ventas/nueva')
    expect(screen.getByText('Aún no hay ventas para mostrar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresos' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Ventas' }))
    expect(screen.getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.get).toHaveBeenCalledWith('/dashboard/summary')
  })
})